<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\Team;
use Carbon\CarbonImmutable;
use Carbon\CarbonPeriod;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class TeamDashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $timezone = (string) config('app.timezone', 'America/Los_Angeles');
        $period = in_array($request->string('period')->toString(), ['daily', 'weekly', 'monthly'], true)
            ? $request->string('period')->toString()
            : 'daily';
        $anchor = $this->anchorDate($request->string('date')->toString(), $timezone);
        [$start, $end] = $this->periodBounds($period, $anchor);
        $dates = collect(CarbonPeriod::create($start, '1 day', $end))
            ->map(fn ($date): string => $date->format('Y-m-d'));

        $createdAtExpression = Schema::hasTable('lead_movements')
            ? 'COALESCE((SELECT MIN(lm.created_at) FROM lead_movements lm WHERE lm.lead_id = leads.id), leads.created_at)'
            : 'leads.created_at';

        $leads = Lead::query()
            ->select(['leads.id', 'agent_id', 'status'])
            ->withExists('project')
            ->whereBetween(DB::raw($createdAtExpression), [
                $start->utc(),
                $end->endOfDay()->utc(),
            ])
            ->selectRaw("{$createdAtExpression} as effective_created_at")
            ->get();

        $soldLeads = Lead::query()
            ->select(['leads.id', 'agent_id', 'appointment_at'])
            ->where('leads.status', 'project')
            ->whereHas('project')
            ->whereBetween('appointment_at', [
                $start->startOfDay()->format('Y-m-d H:i:s'),
                $end->endOfDay()->format('Y-m-d H:i:s'),
            ])
            ->get();

        $workedAgentIds = collect();
        if (Schema::hasTable('calltools_user_login_shifts')) {
            $workedAgentIds = DB::table('calltools_user_login_shifts as shift')
                ->join('agents as agent', 'agent.calltools_user_id', '=', 'shift.app_user_id')
                ->whereBetween('shift.started_at', [
                    $start->startOfDay()->utc(),
                    $end->endOfDay()->utc(),
                ])
                ->distinct()
                ->pluck('agent.agent_id')
                ->map(fn ($id): int => (int) $id);
        }
        $today = CarbonImmutable::today($timezone);
        if (
            $today->betweenIncluded($start, $end)
            && Schema::hasTable('calltools_agent_daily_metrics')
        ) {
            $liveAgentIds = DB::table('calltools_agent_daily_metrics as metric')
                ->join('agents as agent', 'agent.calltools_user_id', '=', 'metric.app_user_id')
                ->where('metric.logged_in', true)
                ->whereDate('metric.metric_date', now('UTC')->toDateString())
                ->whereBetween('metric.logged_in_since', [
                    $start->startOfDay()->utc(),
                    $end->endOfDay()->utc(),
                ])
                ->distinct()
                ->pluck('agent.agent_id')
                ->map(fn ($id): int => (int) $id);
            $workedAgentIds = $workedAgentIds->merge($liveAgentIds)->unique()->values();
        }

        $scores = $leads
            ->groupBy(fn (Lead $lead): int => (int) $lead->agent_id)
            ->map(fn ($agentLeads) => $agentLeads
                ->groupBy(fn (Lead $lead): string => CarbonImmutable::parse($lead->effective_created_at, 'UTC')
                    ->setTimezone($timezone)
                    ->format('Y-m-d')));

        $teams = Team::query()
            ->with([
                'manager:manager_id,manager_name',
                'agents:agents.agent_id,agent_name',
            ])
            ->orderBy('team_name')
            ->get()
            ->map(function (Team $team) use ($dates, $leads, $scores, $soldLeads, $workedAgentIds): array {
                $agentScores = $team->agents
                    ->map(function ($agent) use ($dates, $leads, $scores, $soldLeads, $workedAgentIds): array {
                        $agentId = (int) $agent->agent_id;
                        $daily = $scores->get($agentId, collect());
                        $agentLeads = $leads->where('agent_id', $agentId);

                        return [
                            'id' => $agentId,
                            'name' => $agent->agent_name,
                            'total' => $dates->sum(fn (string $date): int => $daily->get($date, collect())->count()),
                            'confirmed' => $agentLeads->whereIn('status', ['confirmed', 'dispatched'])->count(),
                            'sold' => $soldLeads->where('agent_id', $agentId)->count(),
                            'worked' => $workedAgentIds->contains($agentId),
                        ];
                    })
                    ->sortByDesc('total')
                    ->values();

                $dailyScores = $dates->map(function (string $date) use ($team, $scores): array {
                    $count = $team->agents->sum(
                        fn ($agent): int => $scores
                            ->get((int) $agent->agent_id, collect())
                            ->get($date, collect())
                            ->count(),
                    );

                    return [
                        'date' => $date,
                        'label' => CarbonImmutable::parse($date)->format('M j'),
                        'day' => CarbonImmutable::parse($date)->format('D'),
                        'count' => $count,
                    ];
                });
                $teamAgentIds = $team->agents->pluck('agent_id')->map(fn ($id): int => (int) $id);
                $teamLeads = $leads->whereIn('agent_id', $teamAgentIds);

                return [
                    'id' => (int) $team->team_id,
                    'name' => $team->team_name,
                    'manager' => $team->manager?->manager_name ?? 'No manager',
                    'memberCount' => $team->agents->count(),
                    'total' => $dailyScores->sum('count'),
                    'confirmed' => $teamLeads->whereIn('status', ['confirmed', 'dispatched'])->count(),
                    'sold' => $soldLeads->whereIn('agent_id', $teamAgentIds)->count(),
                    'dailyScores' => $dailyScores,
                    'agents' => $agentScores,
                ];
            })
            ->sortByDesc('total')
            ->values()
            ->map(fn (array $team, int $index): array => [
                ...$team,
                'rank' => $index + 1,
            ]);

        $assignedAgentIds = Team::query()
            ->with('agents:agents.agent_id')
            ->get()
            ->flatMap->agents
            ->pluck('agent_id')
            ->unique();
        $unassignedLeadCount = $leads
            ->whereNotIn('agent_id', $assignedAgentIds)
            ->count();

        return Inertia::render('team-dashboard', [
            'filters' => [
                'period' => $period,
                'date' => $anchor->format('Y-m-d'),
                'timezone' => $timezone,
            ],
            'range' => [
                'start' => $start->format('Y-m-d'),
                'end' => $end->format('Y-m-d'),
                'label' => $this->rangeLabel($period, $start, $end),
            ],
            'summary' => [
                'totalLeads' => $teams->sum('total'),
                'teamCount' => $teams->count(),
                'activeTeams' => $teams->where('total', '>', 0)->count(),
                'unassignedLeads' => $unassignedLeadCount,
                'workedAgents' => $workedAgentIds->unique()->count(),
                'topTeam' => $teams->first()['name'] ?? null,
                'topScore' => $teams->first()['total'] ?? 0,
            ],
            'teams' => $teams,
        ]);
    }

    private function anchorDate(string $value, string $timezone): CarbonImmutable
    {
        try {
            return ($value !== '' ? CarbonImmutable::parse($value, $timezone) : CarbonImmutable::today($timezone))
                ->startOfDay();
        } catch (\Throwable) {
            return CarbonImmutable::today($timezone);
        }
    }

    /** @return array{CarbonImmutable, CarbonImmutable} */
    private function periodBounds(string $period, CarbonImmutable $anchor): array
    {
        return match ($period) {
            'weekly' => [$anchor->startOfWeek(), $anchor->endOfWeek()],
            'monthly' => [$anchor->startOfMonth(), $anchor->endOfMonth()],
            default => [$anchor->startOfDay(), $anchor->endOfDay()],
        };
    }

    private function rangeLabel(string $period, CarbonImmutable $start, CarbonImmutable $end): string
    {
        return match ($period) {
            'weekly' => $start->isSameMonth($end)
                ? $start->format('M j').' – '.$end->format('j, Y')
                : $start->format('M j').' – '.$end->format('M j, Y'),
            'monthly' => $start->format('F Y'),
            default => $start->format('l, F j, Y'),
        };
    }
}
