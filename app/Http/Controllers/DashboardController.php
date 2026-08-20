<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\Project;
use App\Models\Salesman;
use App\Models\Team;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $teamTimezone = (string) config('app.timezone', 'America/Los_Angeles');
        [$teamFrom, $teamTo] = $this->teamDateRange($request, $teamTimezone);
        $createdRange = [$teamFrom->utc(), $teamTo->endOfDay()->utc()];
        $appointmentRange = [
            $teamFrom->startOfDay()->format('Y-m-d H:i:s'),
            $teamTo->endOfDay()->format('Y-m-d H:i:s'),
        ];
        $rangeLeadQuery = fn (): Builder => Lead::query()->whereBetween('created_at', $createdRange);
        $bookingQuery = fn (): Builder => Lead::query()->whereIn('status', ['confirmed', 'dispatched'])->whereBetween('appointment_at', $appointmentRange);
        $totalLeads = $rangeLeadQuery()->count();
        $projectCount = Project::query()->whereBetween('created_at', $createdRange)->count();

        $workflowLanes = collect([
            ['key' => 'fresh', 'label' => 'Freshly In', 'statuses' => ['fresh']],
            ['key' => 'confirmed', 'label' => 'Confirmation', 'statuses' => ['confirmed']],
            ['key' => 'kit', 'label' => 'Keep in Touch', 'statuses' => ['kit', 'kit_ng', 'kit_toss', 'kit_cb']],
            ['key' => 'dispatched', 'label' => 'Dispatch', 'statuses' => ['dispatched']],
            ['key' => 'reschedule', 'label' => 'Reschedule', 'statuses' => ['reschedule']],
        ])->map(function (array $lane) use ($createdRange): array {
            return [
                'key' => $lane['key'],
                'label' => $lane['label'],
                'count' => Lead::query()->whereBetween('created_at', $createdRange)->whereIn('status', $lane['statuses'])->count(),
                'leads' => Lead::query()
                    ->whereBetween('created_at', $createdRange)
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
            ->whereBetween('created_at', $createdRange)
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');
        $effectiveCreatedAt = Schema::hasTable('lead_movements')
            ? 'COALESCE((SELECT MIN(team_lm.created_at) FROM lead_movements team_lm WHERE team_lm.lead_id = leads.id), leads.created_at)'
            : 'leads.created_at';
        $teamLeads = Lead::query()
            ->whereBetween(DB::raw($effectiveCreatedAt), $createdRange)
            ->withExists('project')
            ->get(['leads.id', 'agent_id', 'salesman_1_id', 'salesman_2_id', 'status']);
        $teamSoldLeads = Lead::query()
            ->where('status', 'project')
            ->whereHas('project')
            ->whereBetween('appointment_at', $appointmentRange)
            ->get(['id', 'agent_id']);
        $salesmanLeads = Lead::query()
            ->whereBetween('appointment_at', $appointmentRange)
            ->where(function (Builder $query): void {
                $query->whereNotNull('salesman_1_id')
                    ->orWhereNotNull('salesman_2_id');
            })
            ->withExists([
                'movements as dispatched_exists' => fn (Builder $movementQuery) => $movementQuery
                    ->where('to_status', 'dispatched'),
            ])
            ->withExists('project')
            ->get(['id', 'salesman_1_id', 'salesman_2_id', 'status']);
        $teamPerformance = Team::query()
            ->with([
                'manager:manager_id,manager_name',
                'agents:agents.agent_id,agent_name',
            ])
            ->orderBy('team_name')
            ->get()
            ->map(function (Team $team) use ($teamLeads, $teamSoldLeads): array {
                $agentIds = $team->agents->pluck('agent_id')->map(fn ($id): int => (int) $id);
                $leads = $teamLeads->whereIn('agent_id', $agentIds);
                $agents = $team->agents
                    ->map(function ($agent) use ($teamLeads, $teamSoldLeads): array {
                        $agentLeads = $teamLeads->where('agent_id', $agent->agent_id);

                        return [
                            'id' => (int) $agent->agent_id,
                            'name' => $agent->agent_name,
                            'total' => $agentLeads->count(),
                            'confirmed' => $agentLeads->whereIn('status', ['confirmed', 'dispatched'])->count(),
                            'sold' => $teamSoldLeads->where('agent_id', $agent->agent_id)->count(),
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
                    'sold' => $teamSoldLeads->whereIn('agent_id', $agentIds)->count(),
                    'agents' => $agents,
                ];
            })
            ->sortByDesc('total')
            ->values();
        $salesmanPerformance = Salesman::query()
            ->whereNull('inactive_at')
            ->orderBy('salesman_name')
            ->get(['salesman_id', 'salesman_name'])
            ->map(function (Salesman $salesman) use ($salesmanLeads): array {
                $leads = $salesmanLeads->filter(
                    fn (Lead $lead): bool => (int) $lead->salesman_1_id === (int) $salesman->salesman_id
                        || (int) $lead->salesman_2_id === (int) $salesman->salesman_id,
                );

                return [
                    'id' => (int) $salesman->salesman_id,
                    'name' => $salesman->salesman_name,
                    'assigned' => $leads->filter(
                        fn (Lead $lead): bool => $lead->status === 'dispatched'
                            || (bool) $lead->dispatched_exists,
                    )->count(),
                    'sold' => $leads->where('project_exists', true)->count(),
                ];
            })
            ->sortByDesc('assigned')
            ->values();
        $managerPerformance = DB::table('lead_movements as manager_returns')
            ->join('leads', 'leads.id', '=', 'manager_returns.lead_id')
            ->join('accounts', 'accounts.acc_id', '=', 'manager_returns.moved_by')
            ->join('managers', 'managers.account_id', '=', 'accounts.acc_id')
            ->where('manager_returns.to_status', 'fresh')
            ->whereNotNull('manager_returns.from_status')
            ->whereBetween('manager_returns.created_at', $createdRange)
            ->groupBy('managers.manager_id', 'managers.manager_name')
            ->selectRaw("managers.manager_id as id, managers.manager_name as name,
                COUNT(DISTINCT manager_returns.lead_id) as total,
                COUNT(DISTINCT CASE WHEN EXISTS (
                    SELECT 1 FROM lead_movements confirmed_moves
                    WHERE confirmed_moves.lead_id = manager_returns.lead_id
                    AND confirmed_moves.created_at >= manager_returns.created_at
                    AND confirmed_moves.to_status = 'confirmed'
                ) THEN manager_returns.lead_id END) as confirmed,
                COUNT(DISTINCT CASE WHEN EXISTS (
                    SELECT 1 FROM lead_movements dispatch_moves
                    WHERE dispatch_moves.lead_id = manager_returns.lead_id
                    AND dispatch_moves.created_at >= manager_returns.created_at
                    AND dispatch_moves.to_status = 'dispatched'
                ) THEN manager_returns.lead_id END) as dispatched,
                COUNT(DISTINCT CASE WHEN EXISTS (
                    SELECT 1 FROM projects sold_projects
                    WHERE sold_projects.lead_id = manager_returns.lead_id
                    AND sold_projects.created_at >= manager_returns.created_at
                ) THEN manager_returns.lead_id END) as sold")
            ->orderByDesc('total')
            ->get()
            ->map(fn (object $row): array => [
                'id' => (int) $row->id,
                'name' => $row->name,
                'total' => (int) $row->total,
                'confirmed' => (int) $row->confirmed,
                'dispatched' => (int) $row->dispatched,
                'sold' => (int) $row->sold,
            ]);

        return Inertia::render('dashboard', [
            'metrics' => [
                'totalLeads' => $totalLeads,
                'createdToday' => $totalLeads,
                'createdLastSevenDays' => $totalLeads,
                'activePipeline' => $rangeLeadQuery()->whereNotIn('status', ['project', 'toss'])->count(),
                'soldRate' => $totalLeads > 0 ? round(($projectCount / $totalLeads) * 100, 1) : 0,
                'projects' => $projectCount,
                'completedProjects' => (int) ($projectStatuses['completed'] ?? 0),
            ],
            'teamFilters' => [
                'from' => $teamFrom->format('Y-m-d'),
                'to' => $teamTo->format('Y-m-d'),
                'timezone' => $teamTimezone,
                'all' => $request->boolean('all'),
            ],
            'teamPerformance' => $teamPerformance,
            'salesmanPerformance' => $salesmanPerformance,
            'managerPerformance' => $managerPerformance,
            'bookingPressure' => [
                'today' => $bookingQuery()->count(),
                'tomorrow' => 0,
                'noAppointment' => 0,
                'overdue' => $bookingQuery()->where('appointment_at', '<', now())->count(),
            ],
            'workflowLanes' => $workflowLanes,
            'activeWorkflowCount' => $rangeLeadQuery()->whereNotIn('status', ['project', 'toss'])->count(),
            'topSources' => Lead::query()
                ->whereBetween('created_at', $createdRange)
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
            if ($request->boolean('all')) {
                $minimum = collect([
                    Lead::query()->min('created_at'),
                    Lead::query()->min('appointment_at'),
                    Project::query()->min('created_at'),
                ])->filter()->min();
                $maximum = collect([
                    Lead::query()->max('created_at'),
                    Lead::query()->max('appointment_at'),
                    Project::query()->max('created_at'),
                ])->filter()->max();

                if ($minimum && $maximum) {
                    return [
                        CarbonImmutable::parse((string) $minimum, $timezone)->startOfDay(),
                        CarbonImmutable::parse((string) $maximum, $timezone)->startOfDay(),
                    ];
                }
            }

            $fromValue = $request->input('from', $request->input('team_from'));
            $toValue = $request->input('to', $request->input('team_to'));
            $from = filled($fromValue)
                ? CarbonImmutable::parse((string) $fromValue, $timezone)->startOfDay()
                : CarbonImmutable::today($timezone);
            $to = filled($toValue)
                ? CarbonImmutable::parse((string) $toValue, $timezone)->startOfDay()
                : $from;
        } catch (\Throwable) {
            $from = CarbonImmutable::today($timezone);
            $to = $from;
        }

        return $from->lessThanOrEqualTo($to) ? [$from, $to] : [$to, $from];
    }
}
