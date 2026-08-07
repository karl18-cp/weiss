<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\Project;
use App\Models\Salesman;
use App\Models\Team;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $today = Carbon::today();
        $tomorrow = Carbon::tomorrow();
        $bookingQuery = fn (): Builder => Lead::query()->whereIn('status', ['confirmed', 'dispatched']);
        $totalLeads = Lead::query()->count();
        $projectCount = Project::query()->count();

        $workflowLanes = collect([
            ['key' => 'fresh', 'label' => 'Freshly In', 'statuses' => ['fresh']],
            ['key' => 'confirmed', 'label' => 'Confirmation', 'statuses' => ['confirmed']],
            ['key' => 'kit', 'label' => 'Keep in Touch', 'statuses' => ['kit', 'kit_ng', 'kit_toss', 'kit_cb']],
            ['key' => 'dispatched', 'label' => 'Dispatch', 'statuses' => ['dispatched']],
            ['key' => 'reschedule', 'label' => 'Reschedule', 'statuses' => ['reschedule']],
        ])->map(function (array $lane): array {
            return [
                'key' => $lane['key'],
                'label' => $lane['label'],
                'count' => Lead::query()->whereIn('status', $lane['statuses'])->count(),
                'leads' => Lead::query()
                    ->whereIn('status', $lane['statuses'])
                    ->latest()
                    ->limit(3)
                    ->get(['id', 'customer_name'])
                    ->map(fn (Lead $lead): array => [
                        'id' => $lead->id,
                        'customer' => $lead->customer_name,
                    ]),
            ];
        });

        $projectStatuses = Project::query()
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');
        $teamTimezone = (string) config('app.timezone', 'America/Los_Angeles');
        [$teamFrom, $teamTo] = $this->teamDateRange($request, $teamTimezone);
        $teamLeads = Lead::query()
            ->whereBetween('created_at', [
                $teamFrom->utc(),
                $teamTo->endOfDay()->utc(),
            ])
            ->withExists('project')
            ->get(['id', 'agent_id', 'salesman_1_id', 'salesman_2_id', 'status']);
        $teamPerformance = Team::query()
            ->with([
                'manager:manager_id,manager_name',
                'agents:agents.agent_id,agent_name',
            ])
            ->orderBy('team_name')
            ->get()
            ->map(function (Team $team) use ($teamLeads): array {
                $agentIds = $team->agents->pluck('agent_id')->map(fn ($id): int => (int) $id);
                $leads = $teamLeads->whereIn('agent_id', $agentIds);
                $agents = $team->agents
                    ->map(function ($agent) use ($teamLeads): array {
                        $agentLeads = $teamLeads->where('agent_id', $agent->agent_id);

                        return [
                            'id' => (int) $agent->agent_id,
                            'name' => $agent->agent_name,
                            'total' => $agentLeads->count(),
                            'confirmed' => $agentLeads->whereIn('status', ['confirmed', 'dispatched'])->count(),
                            'sold' => $agentLeads->where('project_exists', true)->count(),
                        ];
                    })
                    ->sortByDesc('total')
                    ->values();

                return [
                    'id' => (int) $team->team_id,
                    'name' => $team->team_name,
                    'manager' => $team->manager?->manager_name ?? 'No manager',
                    'total' => $leads->count(),
                    'confirmed' => $leads->whereIn('status', ['confirmed', 'dispatched'])->count(),
                    'sold' => $leads->where('project_exists', true)->count(),
                    'agents' => $agents,
                ];
            })
            ->sortByDesc('total')
            ->values();
        $salesmanPerformance = Salesman::query()
            ->orderBy('salesman_name')
            ->get(['salesman_id', 'salesman_name'])
            ->map(function (Salesman $salesman) use ($teamLeads): array {
                $leads = $teamLeads->filter(
                    fn (Lead $lead): bool => (int) $lead->salesman_1_id === (int) $salesman->salesman_id
                        || (int) $lead->salesman_2_id === (int) $salesman->salesman_id,
                );

                return [
                    'id' => (int) $salesman->salesman_id,
                    'name' => $salesman->salesman_name,
                    'assigned' => $leads->count(),
                    'sold' => $leads->where('project_exists', true)->count(),
                ];
            })
            ->sortByDesc('assigned')
            ->values();

        return Inertia::render('dashboard', [
            'metrics' => [
                'totalLeads' => $totalLeads,
                'createdToday' => Lead::query()->whereDate('created_at', $today)->count(),
                'createdLastSevenDays' => Lead::query()->where('created_at', '>=', $today->copy()->subDays(6))->count(),
                'activePipeline' => Lead::query()->whereNotIn('status', ['project', 'toss'])->count(),
                'soldRate' => $totalLeads > 0 ? round(($projectCount / $totalLeads) * 100, 1) : 0,
                'projects' => $projectCount,
                'completedProjects' => (int) ($projectStatuses['completed'] ?? 0),
            ],
            'teamFilters' => [
                'from' => $teamFrom->format('Y-m-d'),
                'to' => $teamTo->format('Y-m-d'),
                'timezone' => $teamTimezone,
            ],
            'teamPerformance' => $teamPerformance,
            'salesmanPerformance' => $salesmanPerformance,
            'bookingPressure' => [
                'today' => $bookingQuery()->whereDate('appointment_at', $today)->count(),
                'tomorrow' => $bookingQuery()->whereDate('appointment_at', $tomorrow)->count(),
                'noAppointment' => $bookingQuery()->whereNull('appointment_at')->count(),
                'overdue' => $bookingQuery()->where('appointment_at', '<', now())->count(),
            ],
            'projectHealth' => [
                'new' => (int) ($projectStatuses['new'] ?? 0),
                'progress' => (int) ($projectStatuses['progress'] ?? 0),
                'completed' => (int) ($projectStatuses['completed'] ?? 0),
                'canceled' => (int) ($projectStatuses['canceled'] ?? 0),
            ],
            'workflowLanes' => $workflowLanes,
            'activeWorkflowCount' => Lead::query()->whereNotIn('status', ['project', 'toss'])->count(),
            'topSources' => Lead::query()
                ->selectRaw('source, count(*) as total')
                ->groupBy('source')
                ->orderByDesc('total')
                ->limit(5)
                ->get()
                ->map(fn (Lead $lead): array => [
                    'source' => $lead->source,
                    'total' => (int) $lead->getAttribute('total'),
                ]),
        ]);
    }

    /** @return array{CarbonImmutable, CarbonImmutable} */
    private function teamDateRange(Request $request, string $timezone): array
    {
        try {
            $from = $request->filled('team_from')
                ? CarbonImmutable::parse($request->string('team_from')->toString(), $timezone)->startOfDay()
                : CarbonImmutable::today($timezone);
            $to = $request->filled('team_to')
                ? CarbonImmutable::parse($request->string('team_to')->toString(), $timezone)->startOfDay()
                : $from;
        } catch (\Throwable) {
            $from = CarbonImmutable::today($timezone);
            $to = $from;
        }

        return $from->lessThanOrEqualTo($to) ? [$from, $to] : [$to, $from];
    }
}
