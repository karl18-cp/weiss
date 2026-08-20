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
        $period = in_array($request->string('period')->toString(), ['daily', 'range', 'monthly'], true)
            ? $request->string('period')->toString()
            : 'daily';
        $anchor = $this->anchorDate($request->string('date')->toString(), $timezone);
        [$start, $end] = $period === 'range'
            ? $this->customRange(
                $request->string('from')->toString(),
                $request->string('to')->toString(),
                $anchor,
                $timezone,
            )
            : $this->periodBounds($period, $anchor);
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
        $attendanceLaunch = CarbonImmutable::parse('2026-08-16', $timezone)->startOfDay();
        if (Schema::hasTable('calltools_user_login_shifts')) {
            $workedAgentIds = DB::table('calltools_user_login_shifts as shift')
                ->join('agents as agent', 'agent.calltools_user_id', '=', 'shift.app_user_id')
                ->whereBetween('shift.started_at', [
                    $start->startOfDay()->utc(),
                    $end->endOfDay()->utc(),
                ])
                ->where('shift.started_at', '<', $attendanceLaunch->utc())
                // CallTools can emit placeholder/open shift rows with a start
                // timestamp but no recorded working time. Current live logins
                // are added below from daily metrics; historical attendance
                // must have a positive imported duration.
                ->where('shift.duration_seconds', '>', 0)
                ->distinct()
                ->pluck('agent.agent_id')
                ->map(fn ($id): int => (int) $id);
        }
        $today = CarbonImmutable::today($timezone);
        if (
            $today->lessThan($attendanceLaunch)
            &&
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

        if (Schema::hasTable('agent_attendance_sessions') && $end->greaterThanOrEqualTo($attendanceLaunch)) {
            $portalAgentIds = DB::table('agent_attendance_sessions')
                ->whereBetween('work_date', [
                    $start->max($attendanceLaunch)->toDateString(),
                    $end->toDateString(),
                ])
                ->whereNotNull('clocked_in_at')
                ->distinct()
                ->pluck('agent_id')
                ->map(fn ($id): int => (int) $id);

            $workedAgentIds = $workedAgentIds->merge($portalAgentIds)->unique()->values();
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
                            'dispatched' => $agentLeads->where('status', 'dispatched')->count(),
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
                    'dispatched' => $teamLeads->where('status', 'dispatched')->count(),
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

        return Inertia::render('team-dashboard', [
            'filters' => [
                'period' => $period,
                'date' => $anchor->format('Y-m-d'),
                'from' => $start->format('Y-m-d'),
                'to' => $end->format('Y-m-d'),
                'timezone' => $timezone,
            ],
            'range' => [
                'start' => $start->format('Y-m-d'),
                'end' => $end->format('Y-m-d'),
                'label' => $this->rangeLabel($period, $start, $end),
            ],
            'summary' => [
                'totalLeads' => $teams->sum('total'),
                'confirmed' => $teams->sum('confirmed'),
                'dispatched' => $teams->sum('dispatched'),
                'sold' => $teams->sum('sold'),
                'workedAgents' => $workedAgentIds->unique()->count(),
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
            'monthly' => [$anchor->startOfMonth(), $anchor->endOfMonth()],
            default => [$anchor->startOfDay(), $anchor->endOfDay()],
        };
    }

    /** @return array{CarbonImmutable, CarbonImmutable} */
    private function customRange(
        string $from,
        string $to,
        CarbonImmutable $fallback,
        string $timezone,
    ): array {
        $start = $from !== '' ? $this->anchorDate($from, $timezone) : $fallback;
        $end = $to !== '' ? $this->anchorDate($to, $timezone) : $fallback;

        return $start->lessThanOrEqualTo($end)
            ? [$start->startOfDay(), $end->endOfDay()]
            : [$end->startOfDay(), $start->endOfDay()];
    }

    private function rangeLabel(string $period, CarbonImmutable $start, CarbonImmutable $end): string
    {
        if ($period === 'range' && $start->isSameDay($end)) {
            return $start->format('l, F j, Y');
        }

        return match ($period) {
            'range' => $start->isSameMonth($end)
                ? $start->format('M j').' – '.$end->format('j, Y')
                : $start->format('M j').' – '.$end->format('M j, Y'),
            'monthly' => $start->format('F Y'),
            default => $start->format('l, F j, Y'),
        };
    }
}
