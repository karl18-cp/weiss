<?php

namespace App\Http\Controllers;

use App\Support\LeadSearch;

use App\Support\CaliforniaServiceAreas;

use App\Models\Agent;
use App\Models\Company;
use App\Models\Lead;
use App\Models\LeadAgentAssignment;
use App\Models\Manager;
use App\Models\Product;
use App\Models\Salesman;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class LeadQueueController extends Controller
{
    public function bookingBoard(Request $request): Response
    {
        return $this->bookingBoardResponse($request, 'lead-workflow/booking-board');
    }

    public function salesmanBookingBoard(Request $request): Response
    {
        abort_unless($request->user()?->role === 'salesman', 403);

        return $this->bookingBoardResponse($request, 'salesman/booking-board');
    }

    private function bookingBoardResponse(Request $request, string $page): Response
    {
        $user = $request->user();
        $salesmanId = $user?->role === 'salesman'
            ? $user->salesman?->salesman_id
            : null;

        if ($user?->role === 'salesman') {
            abort_unless($salesmanId, 403, 'Your account is not linked to a salesman profile.');
        }

        $leadQuery = Lead::query()
            ->where('status', 'dispatched')
            ->whereNotNull('appointment_at');

        if ($user?->role === 'salesman') {
            $leadQuery->where(function ($query) use ($salesmanId): void {
                $query->where('salesman_1_id', $salesmanId)
                    ->orWhere('salesman_2_id', $salesmanId);
            });
        }

        return Inertia::render($page, [
            'leads' => $leadQuery
                ->with([
                    'company:com_id,company,prefix',
                    'product:prod_id,product_name',
                    'agent:agent_id,agent_name',
                    'secondAgent:agent_id,agent_name',
                    'secondManager:manager_id,manager_name',
                    'salesmanOne:salesman_id,salesman_name,phone',
                    'salesmanTwo:salesman_id,salesman_name,phone',
                    'notes:id,lead_id,note_type,body,created_at',
                    ...(Schema::hasTable('ringcentral_calls')
                        ? [
                            'ringCentralCalls' => fn ($query) => $query->latest('initiated_at')->limit(20),
                            'ringCentralCalls.caller:acc_id,username',
                        ]
                        : []),
                ])
                ->orderBy('appointment_at')
                ->orderBy('id')
                ->get(),
            'salesmen' => Salesman::query()
                ->whereNull('inactive_at')
                ->when(
                    $user?->role === 'salesman',
                    fn ($query) => $query->whereKey($salesmanId),
                )
                ->orderBy('salesman_name')
                ->get(['salesman_id', 'salesman_name']),
            'salesmanLocations' => $user?->role === 'salesman'
                ? []
                : Salesman::query()
                    ->whereNull('inactive_at')
                    ->whereNotNull('live_latitude')
                    ->whereNotNull('live_longitude')
                    ->where('live_location_updated_at', '>=', now()->subMinutes(30))
                    ->orderBy('salesman_name')
                    ->get([
                        'salesman_id', 'salesman_name', 'live_latitude', 'live_longitude',
                        'live_location_accuracy', 'live_location_updated_at',
                    ]),
            'map' => [
                'key' => config('services.maptiler.browser_key'),
                'styleUrl' => 'https://api.maptiler.com/maps/streets-v2/style.json',
            ],
            'viewerRole' => $user?->role,
            'viewerSalesmanId' => $salesmanId,
            'leadBaseUrl' => $user?->role === 'salesman'
                ? '/salesman/lead-information'
                : '/lead-workflow/leads-shop',
        ]);
    }

    public function confirm(): Response
    {
        return $this->renderQueue('lead-workflow/confirm-leads', 'confirmed');
    }

    public function dispatch(): Response
    {
        return $this->renderQueue('lead-workflow/dispatch-leads', 'dispatched');
    }

    public function sag(): Response
    {
        return $this->renderQueue(
            'lead-workflow/sag',
            null,
            ['completed', 'canceled'],
        );
    }

    public function reschedule(): Response
    {
        return $this->renderQueue('lead-workflow/reschedule', 'reschedule');
    }

    public function rehash(): Response
    {
        return $this->renderQueue('lead-workflow/rehash', ['rehash', 'rehash_ng', 'rehash_toss', 'rehash_cb']);
    }

    public function fiveFiveFive(): Response
    {
        return $this->renderQueue('lead-workflow/five-five-five', ['555', 'ora', 'la', 'ng', 'toss']);
    }

    public function la(): Response
    {
        return $this->renderQueue('lead-workflow/la', 'la');
    }

    public function his(): Response
    {
        return $this->renderQueue('lead-workflow/his', 'his', null, 'hybrid', 25);
    }

    public function toss(): Response
    {
        return $this->renderQueue('lead-workflow/toss-leads', 'toss');
    }

    public function keepInTouch(): Response
    {
        return $this->renderQueue('lead-workflow/keep-in-touch', ['kit', 'kit_ng', 'kit_toss', 'kit_cb']);
    }

    private function renderQueue(
        string $page,
        string|array|null $status,
        string|array|null $projectStatus = null,
        string $dateGranularity = 'day',
        ?int $perPage = null,
    ): Response {
        $search = trim((string) request()->query('search', ''));
        $selectedCity = trim((string) request()->query('city', ''));
        $requestedLeadId = request()->integer('lead') ?: null;
        $dateField = request()->routeIs('lead-workflow.toss-leads')
            ? 'created_at'
            : 'appointment_at';
        // Queue navigators always follow the California business day. This is
        // intentionally independent from the server and viewer timezones.
        $crmTimezone = 'America/Los_Angeles';
        $offsetDate = (string) request()->query('date', 'now');
        if ($offsetDate === 'unscheduled') {
            $offsetDate = 'now';
        }
        if (in_array($dateGranularity, ['month', 'hybrid'], true) && preg_match('/^\d{4}-\d{2}$/', $offsetDate)) {
            $offsetDate .= '-01';
        }
        $timezoneOffset = (int) (CarbonImmutable::parse($offsetDate, $crmTimezone)->utcOffset() / 60);
        $dateExpression = $dateField === 'created_at' && Schema::hasTable('lead_movements')
            ? 'COALESCE((SELECT MIN(lm.created_at) FROM lead_movements lm WHERE lm.lead_id = leads.id), leads.created_at)'
            : 'leads.'.$dateField;
        $usesDateFallback = request()->routeIs('lead-workflow.la')
            || request()->routeIs('lead-workflow.his');
        if ($usesDateFallback) {
            $dateExpression = 'COALESCE(leads.appointment_at, leads.created_at)';
        }
        if ($dateField === 'created_at') {
            $dateExpression = Schema::getConnection()->getDriverName() === 'sqlite'
                ? sprintf("datetime(%s, '%+d minutes')", $dateExpression, $timezoneOffset)
                : "DATE_ADD({$dateExpression}, INTERVAL {$timezoneOffset} MINUTE)";
        }
        $monthExpression = Schema::getConnection()->getDriverName() === 'sqlite'
            ? "strftime('%Y-%m', {$dateExpression})"
            : "DATE_FORMAT({$dateExpression}, '%Y-%m')";
        $periodExpression = $dateGranularity === 'month'
            ? $monthExpression
            : "DATE({$dateExpression})";

        $queueQuery = Lead::query()
            ->when($status !== null, fn ($query) => $query->whereIn('status', (array) $status))
            ->when($projectStatus, fn ($query) => $query->whereHas(
                'project',
                fn ($project) => $project->whereIn('status', (array) $projectStatus),
            ))
            ->when($search !== '', function ($query) use ($search): void {
                $like = '%'.$search.'%';
                $query->where(function ($query) use ($like, $search): void {
                    $query->where('customer_name', 'like', $like)
                        ->orWhere('address', 'like', $like)
                        ->orWhere('city', 'like', $like)
                        ->orWhere('state', 'like', $like)
                        ->orWhere('zip_code', 'like', $like)
                        ->orWhere('email', 'like', $like)
                        ->orWhere('primary_number', 'like', $like)
                        ->orWhere('secondary_number', 'like', $like)
                        ->orWhere('mobile_number', 'like', $like)
                        ->orWhereHas('company', fn ($relation) => $relation->where('company', 'like', $like))
                        ->orWhereHas('product', fn ($relation) => $relation->where('product_name', 'like', $like))
                        ->orWhereHas('agent', fn ($relation) => $relation->where('agent_name', 'like', $like));
                    LeadSearch::orWhereFullAddress($query, $search);
                });
            });

        $queueManagers = collect();
        $selectedQueueManager = 'all';
        $canViewAllQueueManagers = false;
        if (request()->routeIs('lead-workflow.keep-in-touch') && Schema::hasTable('lead_movements')) {
            $user = request()->user();
            $canViewAllQueueManagers = $user?->role === 'admin'
                || ($user?->role === 'manager' && ($user->manager?->permissions()
                    ->where('module', 'view_all_kit_managers')
                    ->whereIn('access_level', ['view', 'edit'])
                    ->exists() ?? false));
            $kitStatuses = ['kit', 'kit_ng', 'kit_toss', 'kit_cb'];
            $applyManagerOwner = static function ($query, int $accountId) use ($kitStatuses): void {
                $query->whereExists(function ($movement) use ($accountId, $kitStatuses): void {
                    $movement->selectRaw('1')
                        ->from('lead_movements as kit_owner')
                        ->whereColumn('kit_owner.lead_id', 'leads.id')
                        ->where('kit_owner.moved_by', $accountId)
                        ->whereIn('kit_owner.to_status', $kitStatuses)
                        ->where(function ($entry) use ($kitStatuses): void {
                            $entry->whereNull('kit_owner.from_status')
                                ->orWhereNotIn('kit_owner.from_status', $kitStatuses);
                        })
                        ->whereRaw('kit_owner.id = (SELECT MAX(kit_latest.id) FROM lead_movements kit_latest WHERE kit_latest.lead_id = leads.id AND kit_latest.to_status IN (?, ?, ?, ?) AND (kit_latest.from_status IS NULL OR kit_latest.from_status NOT IN (?, ?, ?, ?)))', [...$kitStatuses, ...$kitStatuses]);
                });
            };

            $unfilteredKitQuery = clone $queueQuery;
            $leadManagers = Manager::query()
                ->with('account:acc_id,username')
                ->whereNotNull('account_id')
                ->whereHas('account', fn ($account) => $account->whereNull('suspended_at'))
                ->orderBy('manager_name')
                ->get()
                ->filter(fn (Manager $manager): bool => in_array('Leads Manager', $manager->manager_types ?? [], true));

            if ($canViewAllQueueManagers) {
                $requestedManager = (string) request()->query('manager', 'all');
                $validManager = $leadManagers->firstWhere('account_id', (int) $requestedManager);
                if ($requestedManager !== 'all' && $validManager) {
                    $selectedQueueManager = (string) $validManager->account_id;
                    $applyManagerOwner($queueQuery, (int) $validManager->account_id);
                }
            } elseif ($user?->role === 'manager') {
                $selectedQueueManager = (string) $user->acc_id;
                $applyManagerOwner($queueQuery, (int) $user->acc_id);
            }

            $visibleManagers = $canViewAllQueueManagers
                ? $leadManagers
                : $leadManagers->where('account_id', $user?->acc_id);
            $queueManagers = $visibleManagers->map(function (Manager $manager) use ($unfilteredKitQuery, $applyManagerOwner): array {
                $managerQuery = clone $unfilteredKitQuery;
                $applyManagerOwner($managerQuery, (int) $manager->account_id);

                return [
                    'id' => (string) $manager->account_id,
                    'name' => $manager->manager_name,
                    'count' => $managerQuery->count(),
                ];
            })->values();
        }

        $currentMonth = now($crmTimezone)->format('Y-m');
        $dateRows = (clone $queueQuery)
            ->when(
                $usesDateFallback,
                fn ($query) => $query->whereRaw("{$dateExpression} IS NOT NULL"),
                fn ($query) => $query->whereNotNull($dateField),
            )
            ->selectRaw("{$dateExpression} as date_value")
            ->get()
            ->pluck('date_value')
            ->filter()
            ->map(function ($value) use ($dateGranularity, $currentMonth): string {
                $date = substr((string) $value, 0, 10);

                if ($dateGranularity === 'month') {
                    return substr($date, 0, 7);
                }

                if ($dateGranularity === 'hybrid' && ! str_starts_with($date, $currentMonth)) {
                    return substr($date, 0, 7);
                }

                return $date;
            })
            ->countBy()
            ->sortKeysDesc()
            ->map(fn (int $count, string $date): array => ['key' => $date, 'count' => $count])
            ->values();
        $includesUnscheduledBucket = request()->routeIs('lead-workflow.keep-in-touch');
        if ($includesUnscheduledBucket) {
            $unscheduledCount = (clone $queueQuery)->whereNull('appointment_at')->count();

            if ($unscheduledCount > 0) {
                $dateRows->push(['key' => 'unscheduled', 'count' => $unscheduledCount]);
            }
        }
        $requestedLeadDate = $requestedLeadId
            ? (clone $queueQuery)
                ->whereKey($requestedLeadId)
                ->selectRaw("{$dateExpression} as date_value")
                ->first()?->date_value
            : null;
        $requestedDateKey = null;
        if ($requestedLeadDate) {
            $requestedDate = substr((string) $requestedLeadDate, 0, 10);
            $requestedDateKey = $dateGranularity === 'month'
                || ($dateGranularity === 'hybrid' && ! str_starts_with($requestedDate, $currentMonth))
                    ? substr($requestedDate, 0, 7)
                    : $requestedDate;
        }
        $todayDateKey = $dateGranularity === 'month'
            ? now($crmTimezone)->format('Y-m')
            : now($crmTimezone)->toDateString();
        $availableDateKeys = collect($dateRows)->pluck('key');
        $selectedDate = $availableDateKeys->contains(request()->query('date'))
            ? request()->query('date')
            : ($requestedDateKey ?: (
                $availableDateKeys->contains($todayDateKey)
                    ? $todayDateKey
                    : data_get($dateRows, '0.key')
            ));

        return Inertia::render($page, [
            // Keep the queue badge independent from the appointment-date
            // navigator. Leads without an appointment still belong to the
            // queue and must be included in its total.
            'queueTotal' => (clone $queueQuery)->count(),
            'queueManagers' => $queueManagers,
            'selectedQueueManager' => $selectedQueueManager,
            'canViewAllQueueManagers' => $canViewAllQueueManagers,
            'leads' => (clone $queueQuery)
                ->when(
                    $selectedCity !== '' && $selectedCity !== 'all',
                    fn ($query) => CaliforniaServiceAreas::apply($query, $selectedCity),
                    fn ($query) => $query->when(
                        $selectedDate,
                        function ($query) use (
                            $selectedDate,
                            $includesUnscheduledBucket,
                            $periodExpression,
                            $monthExpression,
                            $dateGranularity,
                            $requestedLeadId,
                        ): void {
                            $query->where(function ($dateQuery) use (
                                $selectedDate,
                                $includesUnscheduledBucket,
                                $periodExpression,
                                $monthExpression,
                                $dateGranularity,
                                $requestedLeadId,
                            ): void {
                                if ($selectedDate === 'unscheduled' && $includesUnscheduledBucket) {
                                    $dateQuery->whereNull('appointment_at');
                                } else {
                                    $selectedExpression = $dateGranularity === 'hybrid'
                                        && preg_match('/^\d{4}-\d{2}$/', $selectedDate)
                                            ? $monthExpression
                                            : $periodExpression;
                                    $dateQuery->whereRaw("{$selectedExpression} = ?", [$selectedDate]);
                                }

                                // A sidebar/global-search selection must remain
                                // visible even when it has no appointment or its
                                // appointment falls outside the active date bucket.
                                // The explicit lead ID is still constrained by the
                                // queue status and the user's module permission.
                                if ($requestedLeadId) {
                                    $dateQuery->orWhere(
                                        $dateQuery->getModel()->getQualifiedKeyName(),
                                        $requestedLeadId,
                                    );
                                }
                            });
                        },
                        fn ($query) => $query->whereRaw('1 = 0'),
                    ),
                )
                ->with([
                    'company:com_id,company,prefix',
                    'product:prod_id,product_name',
                    'agent:agent_id,agent_name',
                    'secondAgent:agent_id,agent_name',
                    'secondManager:manager_id,manager_name',
                    'salesmanOne:salesman_id,salesman_name,phone',
                    'salesmanTwo:salesman_id,salesman_name,phone',
                    // Expanded notes must show the complete saved history, not
                    // only the newest subset. The frontend groups these records
                    // by note type and keeps the list independently scrollable.
                    'notes' => fn ($query) => $query->latest(),
                    'notes.creator:acc_id,username',
                    'appointmentResultNotes',
                    ...(Schema::hasTable('ringcentral_calls')
                        ? [
                            'ringCentralCalls' => fn ($query) => $query->latest('initiated_at')->limit(20),
                            'ringCentralCalls.caller:acc_id,username',
                        ]
                        : []),
                    ...(Schema::hasTable('lead_movements')
                        ? [
                            'movements' => fn ($query) => $query->latest()->limit(30),
                            'movements.mover:acc_id,username',
                        ]
                        : []),
                    ...(class_exists(LeadAgentAssignment::class) && Schema::hasTable('lead_agent_assignments')
                        ? [
                            'agentAssignments.agent:agent_id,agent_name',
                            'agentAssignments.assigner:acc_id,username',
                        ]
                        : []),
                ])
                ->when($requestedLeadId, fn ($query) => $query->orderByRaw('id = ? DESC', [$requestedLeadId]))
                ->latest()
                ->when(
                    $perPage,
                    fn ($query) => $query->paginate($perPage)->withQueryString(),
                    fn ($query) => $query->get(),
                ),
            'dateRows' => $dateRows,
            'selectedDate' => $selectedDate,
            'selectedCity' => $selectedCity !== '' ? $selectedCity : 'all',
            'dateField' => $dateField,
            'dateGranularity' => $dateGranularity,
            'timezoneOffset' => $timezoneOffset,
            'companies' => Company::query()->orderBy('company')->get(['com_id', 'company']),
            'products' => Product::query()->orderBy('product_name')->get(['prod_id', 'product_name']),
            'cities' => CaliforniaServiceAreas::counties(),
            'agents' => Agent::query()->orderBy('agent_name')->get(['agent_id', 'agent_name']),
            'salesmen' => Salesman::query()->whereNull('inactive_at')->orderBy('salesman_name')->get(['salesman_id', 'salesman_name']),
        ]);
    }
}
