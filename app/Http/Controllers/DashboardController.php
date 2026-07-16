<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\Project;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(): Response
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
            'priority' => [
                'raw' => Lead::query()->where('status', 'raw')->count(),
                'noAppointment' => Lead::query()->whereNull('appointment_at')->count(),
                'overdue' => $bookingQuery()->where('appointment_at', '<', now())->count(),
                'today' => $bookingQuery()->whereDate('appointment_at', $today)->count(),
            ],
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
}
