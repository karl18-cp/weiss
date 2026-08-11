<?php

namespace App\Http\Controllers;

use App\Http\Requests\LeadAppointmentResultRequest;
use App\Http\Requests\LeadNoteRequest;
use App\Http\Requests\LeadRequest;
use App\Http\Requests\LeadSaleRequest;
use App\Http\Requests\LeadSalesmenRequest;
use App\Http\Requests\LeadStatusRequest;
use App\Models\Agent;
use App\Models\Company;
use App\Models\Lead;
use App\Models\LeadAgentAssignment;
use App\Models\LeadMovement;
use App\Models\LeadNote;
use App\Models\Product;
use App\Models\Project;
use App\Models\Salesman;
use App\Support\ManagerAccess;
use App\Support\PhoneNumberVisibility;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class LeadsShopController extends Controller
{
    public function latestMarker(Request $request): JsonResponse
    {
        $query = Lead::query()->inLeadsShop();
        $this->scopeManagerCallbacks($query, $request);

        $latestLead = $query
            ->latest('created_at')
            ->latest('id')
            ->first(['id', 'created_at']);

        return response()->json([
            'latest' => $latestLead ? [
                'id' => $latestLead->id,
                'created_at' => $latestLead->created_at?->toISOString(),
            ] : null,
        ]);
    }

    public function index(Request $request): Response
    {
        $requestedLeadId = $request->integer('lead') ?: null;
        $search = trim((string) $request->query('search', ''));
        $selectedCity = trim((string) $request->query('city', ''));
        $activeShopStatus = $request->query('queue_status') === 'verify'
            ? 'verify'
            : null;
        $dateField = $request->query('date_field') === 'appointment_at'
            ? 'appointment_at'
            : 'created_at';
        // Workflow dates are business dates, so their default must not depend
        // on the server, browser, or APP_TIMEZONE setting.
        $crmTimezone = 'America/Los_Angeles';
        $effectiveCreatedAtExpression = Schema::hasTable('lead_movements')
            ? 'COALESCE((SELECT MIN(lm.created_at) FROM lead_movements lm WHERE lm.lead_id = leads.id), leads.created_at)'
            : 'leads.created_at';
        $dateExpression = $dateField === 'created_at'
            ? $effectiveCreatedAtExpression
            : 'leads.'.$dateField;

        if ($requestedLeadId && $request->user()?->role === 'salesman') {
            $salesmanId = $request->user()->salesman?->salesman_id;

            abort_unless(
                $salesmanId && Lead::query()
                    ->whereKey($requestedLeadId)
                    ->where(function ($query) use ($salesmanId): void {
                        $query->where('salesman_1_id', $salesmanId)
                            ->orWhere('salesman_2_id', $salesmanId);
                    })
                    ->exists(),
                404,
            );
        }

        $queueQuery = Lead::query()
            ->where(function ($query) use ($requestedLeadId): void {
                $query->whereIn('status', Lead::LEADS_SHOP_STATUSES)
                    ->when(
                        $requestedLeadId,
                        fn ($query) => $query->orWhere('id', $requestedLeadId),
                    );
            })
            ->when($search !== '', function ($query) use ($search): void {
                $like = '%'.$search.'%';
                $query->where(function ($query) use ($like): void {
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
                });
            });

        $this->scopeManagerCallbacks($queueQuery, $request);

        $verifyCount = (clone $queueQuery)->where('status', 'verify')->count();

        $dateCounts = $dateField === 'created_at'
            ? (clone $queueQuery)
                ->selectRaw("{$effectiveCreatedAtExpression} as created_date_value")
                ->addSelect('leads.id', 'leads.rehash_at')
                ->get()
                ->flatMap(function (Lead $lead) use ($crmTimezone): array {
                    return collect([
                        $lead->getAttribute('created_date_value'),
                        $lead->rehash_at,
                    ])
                        ->filter()
                        ->map(fn ($value): string => CarbonImmutable::parse((string) $value, 'UTC')
                            ->setTimezone($crmTimezone)
                            ->toDateString())
                        ->unique()
                        ->all();
                })
                ->countBy()
            : (clone $queueQuery)
                ->whereNotNull('appointment_at')
                ->pluck('appointment_at')
                ->filter()
                ->map(fn ($value): string => substr((string) $value, 0, 10))
                ->countBy();
        // Keep a stable 30-day navigator even after the final lead on a day
        // is moved elsewhere. Without the zero-count rows, the active date
        // disappears from the sidebar in the middle of a manager's workflow.
        $dateRows = collect(range(0, 29))
            ->map(function (int $daysAgo) use ($crmTimezone, $dateCounts): array {
                $date = CarbonImmutable::today($crmTimezone)
                    ->subDays($daysAgo)
                    ->toDateString();

                return [
                    'key' => $date,
                    'count' => (int) ($dateCounts[$date] ?? 0),
                ];
            });

        $requestedLeadDate = $requestedLeadId
            ? (clone $queueQuery)
                ->whereKey($requestedLeadId)
                ->selectRaw("{$dateExpression} as date_value")
                ->first()?->date_value
            : null;
        $requestedDateKey = $requestedLeadDate
            ? ($dateField !== 'appointment_at'
                ? CarbonImmutable::parse((string) $requestedLeadDate, 'UTC')->setTimezone($crmTimezone)->toDateString()
                : substr((string) $requestedLeadDate, 0, 10))
            : null;
        $todayDateKey = now($crmTimezone)->toDateString();
        $selectedDate = collect($dateRows)->contains('key', $request->query('date'))
            ? $request->query('date')
            : ($requestedDateKey ?: ($search !== '' ? data_get($dateRows, '0.key') : $todayDateKey));

        // These summary cards describe what happened to the leads created on
        // the selected day. Counting LeadMovement timestamps here made the
        // cards change whenever an older lead was moved through the workflow.
        // Match TeamDashboardController exactly: a selected California date
        // is converted to its corresponding UTC start/end boundaries before
        // filtering the UTC timestamps stored in the database.
        $selectedCaliforniaDay = CarbonImmutable::parse($selectedDate, $crmTimezone);
        $createdFrom = $selectedCaliforniaDay->startOfDay()->utc();
        $createdTo = $selectedCaliforniaDay->endOfDay()->utc();
        $managerReturnQuery = LeadMovement::query()
            ->where('to_status', 'fresh')
            ->whereIn('from_status', [
                '555',
                'reschedule',
                'rehash',
                'rehash_ng',
                'rehash_toss',
                'rehash_cb',
                'la',
                'his',
                'project',
            ])
            ->whereBetween('created_at', [$createdFrom, $createdTo])
            ->whereHas('mover', fn ($account) => $account->where('role', 'manager'));
        $managerReturns = [
            'leads' => (clone $managerReturnQuery)->distinct()->count('lead_id'),
            'managers' => (clone $managerReturnQuery)->distinct()->count('moved_by'),
        ];

        $createdDayQuery = Lead::query()
            // Use the same scored population as TeamDashboardController. A
            // legacy CallTools lead can predate provider contact IDs, while
            // direct projects assigned outside a team must not inflate this
            // operational count.
            ->whereIn('agent_id', DB::table('agent_team')->select('agent_id')->distinct())
            ->whereNotNull('created_at')
            ->whereBetween(DB::raw($effectiveCreatedAtExpression), [$createdFrom, $createdTo]);
        $createdDayTotal = (clone $createdDayQuery)->count();
        $agentDayTotal = (clone $createdDayQuery)->distinct()->count('agent_id');
        $overallDayTotal = $createdDayTotal + $managerReturns['leads'];
        $movementCounts = (clone $createdDayQuery)
            ->selectRaw('status, COUNT(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        $movementDestinations = collect([[
            'status' => 'leads_shop',
            'label' => 'Leads Shop',
            'count' => collect(Lead::LEADS_SHOP_STATUSES)
                ->sum(fn (string $status): int => (int) ($movementCounts[$status] ?? 0)),
        ]]);
        $movementDestinations->push(...collect([
            'confirmed' => 'Confirm',
            'dispatched' => 'Dispatch',
            'reschedule' => 'Reschedule',
            'rehash' => 'Rehash',
            '555' => '555',
            'kit' => 'Keep in Touch',
            'toss' => 'TOSS',
            'project' => 'Projects',
        ])->map(fn (string $label, string $status): array => [
            'status' => $status,
            'label' => $label,
            'count' => (int) ($movementCounts[$status] ?? 0),
        ])->values()->all());

        $knownDestinations = $movementDestinations->pluck('status');
        $otherMovementCount = $movementCounts
            ->except([
                ...$knownDestinations->all(),
                ...Lead::LEADS_SHOP_STATUSES,
            ])
            ->sum();
        if ($otherMovementCount > 0) {
            $movementDestinations->push([
                'status' => 'other',
                'label' => 'Other',
                'count' => (int) $otherMovementCount,
            ]);
        }

        return Inertia::render('lead-workflow/leads-shop', [
            'leads' => (clone $queueQuery)
                ->when(
                    $activeShopStatus === 'verify',
                    fn ($query) => $query->where('status', 'verify'),
                )
                ->when(
                    $selectedCity !== '' && $selectedCity !== 'all',
                    fn ($query) => $query->where('city', $selectedCity),
                    fn ($query) => $query->when(
                        $activeShopStatus !== 'verify',
                        fn ($query) => $query->when(
                            $selectedDate,
                            fn ($query) => $dateField === 'created_at'
                                ? $query->where(function ($dates) use ($effectiveCreatedAtExpression, $createdFrom, $createdTo): void {
                                    $dates->whereBetween(DB::raw($effectiveCreatedAtExpression), [$createdFrom, $createdTo])
                                        ->orWhereBetween('rehash_at', [$createdFrom, $createdTo]);
                                })
                                : $query->whereDate('appointment_at', $selectedDate),
                            fn ($query) => $query->whereRaw('1 = 0'),
                        ),
                    ),
                )
                ->with([
                    'company:com_id,company,prefix',
                    'product:prod_id,product_name',
                    'agent:agent_id,agent_name',
                    'secondAgent:agent_id,agent_name',
                    'secondManager:manager_id,manager_name',
                    'duplicateOf:id,customer_name,primary_number,created_at,status',
                    'duplicateOf.project:id,lead_id',
                    'salesmanOne:salesman_id,salesman_name',
                    'salesmanTwo:salesman_id,salesman_name',
                    'notes' => fn ($query) => $query->latest()->limit(25),
                    'notes.creator:acc_id,username',
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
                    $activeShopStatus === 'verify',
                    fn ($query) => $query->paginate(25)->withQueryString(),
                    fn ($query) => $query->get(),
                ),
            'dateRows' => $dateRows,
            'selectedDate' => $selectedDate,
            'selectedCity' => $selectedCity !== '' ? $selectedCity : 'all',
            'activeShopStatus' => $activeShopStatus,
            'verifyCount' => $verifyCount,
            'dateField' => $dateField,
            'timezoneOffset' => (int) ($selectedCaliforniaDay->utcOffset() / 60),
            'movementDestinations' => $movementDestinations,
            'createdDayTotal' => $createdDayTotal,
            'agentDayTotal' => $agentDayTotal,
            'overallDayTotal' => $overallDayTotal,
            'managerReturns' => $managerReturns,
            'companies' => Company::query()->orderBy('company')->get(['com_id', 'company']),
            'products' => Product::query()->orderBy('product_name')->get(['prod_id', 'product_name']),
            'cities' => tap(Lead::query(), fn ($query) => $this->scopeManagerCallbacks($query, $request))
                ->where(function ($query) use ($requestedLeadId): void {
                    $query->whereIn('status', Lead::LEADS_SHOP_STATUSES)
                        ->when(
                            $requestedLeadId,
                            fn ($query) => $query->orWhere('id', $requestedLeadId),
                        );
                })
                ->whereNotNull('city')
                ->where('city', '!=', '')
                ->distinct()
                ->orderBy('city')
                ->pluck('city'),
            'agents' => Agent::query()->orderBy('agent_name')->get(['agent_id', 'agent_name']),
            'salesmen' => Salesman::query()->orderBy('salesman_name')->get(['salesman_id', 'salesman_name']),
        ]);
    }

    /**
     * Managers own the callback queue entries they most recently moved into
     * CB. Other Leads Shop lanes stay shared unless their own permissions say
     * otherwise.
     */
    private function scopeManagerCallbacks($query, Request $request): void
    {
        $account = $request->user();

        if (
            ! $account
            || $account->role !== 'manager'
            || ManagerAccess::hasEnabledFlag($account, 'view_all_callbacks')
            || ! Schema::hasTable('lead_movements')
        ) {
            return;
        }

        $accountId = (int) $account->acc_id;

        $query->where(function ($scope) use ($accountId): void {
            $scope->where('leads.status', '!=', 'cb')
                ->orWhereExists(function ($movement) use ($accountId): void {
                    $movement->selectRaw('1')
                        ->from('lead_movements as callback_owner')
                        ->whereColumn('callback_owner.lead_id', 'leads.id')
                        ->where('callback_owner.to_status', 'cb')
                        ->where('callback_owner.moved_by', $accountId)
                        ->whereRaw(
                            'callback_owner.id = (SELECT MAX(callback_latest.id) FROM lead_movements callback_latest WHERE callback_latest.lead_id = leads.id AND callback_latest.to_status = ?)',
                            ['cb'],
                        );
                });
        });
    }

    public function update(LeadRequest $request, Lead $lead): RedirectResponse
    {
        DB::transaction(function () use ($request, $lead): void {
            $data = $request->validated();
            $correctedCreatedAt = filled($data['lead_created_at'] ?? null)
                ? CarbonImmutable::parse($data['lead_created_at'], 'America/Los_Angeles')->utc()
                : null;
            unset($data['lead_created_at']);
            if (! PhoneNumberVisibility::canView($request->user())) {
                unset($data['primary_number'], $data['secondary_number'], $data['mobile_number']);
            }
            // This field is read-only in the edit UI. Never overwrite it with a
            // stale or blank value submitted by an already-open lead card.
            unset($data['telemarketer_notes']);
            $reassignedAgentId = (int) $data['agent_id'];
            unset($data['agent_id']);
            $previousSalesmen = [
                'salesman_1_id' => $lead->salesman_1_id,
                'salesman_2_id' => $lead->salesman_2_id,
            ];

            $lead->update([
                ...$data,
                'crm_qualification_completed_at' => now(),
            ]);

            if ($correctedCreatedAt !== null) {
                // Lead-created date filters use the earliest movement as the
                // historical creation marker. Correct both timestamps so the
                // transferred lead leaves today's counts everywhere.
                $lead->forceFill(['created_at' => $correctedCreatedAt])->saveQuietly();
                $lead->movements()->reorder()->oldest('created_at')->oldest('id')->first()
                    ?->forceFill(['created_at' => $correctedCreatedAt])->saveQuietly();
            }

            $this->recordSalesmanChanges($request, $lead, $previousSalesmen);
            $this->appendAgentAssignment($request, $lead, $reassignedAgentId);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Lead updated.']);

        return back();
    }

    public function updateAppointment(Request $request, Lead $lead): RedirectResponse
    {
        $data = $request->validate([
            'appointment_at' => ['nullable', 'date'],
        ]);

        $previousAppointment = $lead->appointment_at?->copy();
        $nextAppointment = filled($data['appointment_at'] ?? null)
            ? now()->parse($data['appointment_at'])
            : null;

        $appointmentChanged = $previousAppointment?->timestamp !== $nextAppointment?->timestamp;

        DB::transaction(function () use ($request, $lead, $previousAppointment, $nextAppointment, $appointmentChanged): void {
            $lead->update([
                'appointment_at' => $nextAppointment,
            ]);

            if (! $appointmentChanged) {
                return;
            }

            $formatAppointment = static fn ($appointment): string => $appointment
                ? $appointment->timezone(config('app.timezone'))->format('M j, Y, g:i A T')
                : 'No appointment';

            $lead->notes()->create([
                'note_type' => 'appointment_date_change',
                'body' => sprintf(
                    'Appointment changed from %s to %s.',
                    $formatAppointment($previousAppointment),
                    $formatAppointment($nextAppointment),
                ),
                'created_by' => $request->user()?->getAuthIdentifier(),
            ]);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Appointment updated.']);

        return back();
    }

    public function destroy(Request $request, Lead $lead): RedirectResponse
    {
        abort_unless($request->user()?->role === 'admin', 403);

        $hadProject = $lead->project()->exists();

        DB::transaction(function () use ($lead): void {
            // The project and its sales, payments, invoices, and accounting
            // records use cascading foreign keys, so deleting the lead removes
            // the complete linked project graph atomically.
            $lead->delete();
        });

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $hadProject
                ? 'Lead and linked project deleted.'
                : 'Lead deleted.',
        ]);

        return back();
    }

    public function storeNote(LeadNoteRequest $request, Lead $lead): RedirectResponse
    {
        $noteType = $request->validated('note_type');
        $locked = $noteType === 'telemarketer'
            || (
                $lead->status === 'dispatched'
                && $noteType === 'confirmation'
            );

        if ($locked) {
            throw ValidationException::withMessages([
                'body' => $noteType === 'telemarketer'
                    ? 'Telemarketer notes are read-only in the CRM.'
                    : 'This note type is locked after the lead reaches Dispatch.',
            ]);
        }

        LeadNote::query()->create([
            'lead_id' => $lead->id,
            ...$request->validated(),
            'created_by' => $request->user()->getAuthIdentifier(),
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Note saved.']);

        return back();
    }

    public function updateStatus(LeadStatusRequest $request, Lead $lead): RedirectResponse
    {
        $validated = $request->validated();
        $status = $validated['status'];
        $followUpAt = $validated['follow_up_at'] ?? null;
        $appointmentResultNote = trim((string) ($validated['appointment_result_note'] ?? ''));

        if (
            $lead->status === 'dispatched'
            && in_array($status, ['kit', 'rehash', 'reschedule'], true)
            && blank($followUpAt)
        ) {
            throw ValidationException::withMessages([
                'follow_up_at' => 'Choose when the follow-up call should happen before moving this lead.',
            ]);
        }
        $sourcePath = (string) parse_url(
            (string) $request->headers->get('referer', ''),
            PHP_URL_PATH,
        );
        $restrictedActionPaths = [
            '/lead-workflow/555',
            '/lead-workflow/reschedule',
            '/lead-workflow/rehash',
            '/lead-workflow/la',
            '/lead-workflow/his',
            '/lead-workflow/sag',
        ];
        $restrictedSourceStatuses = [
            '555',
            'reschedule',
            'rehash',
            'rehash_ng',
            'rehash_toss',
            'rehash_cb',
            'la',
            'his',
        ];
        $isRestrictedActionSource = in_array($sourcePath, $restrictedActionPaths, true)
            || in_array($lead->status, $restrictedSourceStatuses, true)
            || $lead->project()
                ->whereIn('status', ['completed', 'canceled'])
                ->exists();

        if (
            $status !== 'fresh'
            && $isRestrictedActionSource
            && ! ManagerAccess::canEdit($request->user(), 'queue_action_buttons')
        ) {
            Inertia::flash('toast', [
                'type' => 'error',
                'title' => 'Permission required',
                'message' => 'You may only return leads to Leads Shop from this tab.',
            ]);

            return back();
        }

        $destinationModule = match (true) {
            $status === 'confirmed' => 'confirm_leads',
            $status === 'dispatched' => 'dispatch_leads',
            $status === 'reschedule' => 'reschedule',
            in_array($status, ['toss', 'rehash_toss', 'kit_toss'], true) => 'toss_action',
            in_array($status, ['rehash', 'rehash_ng', 'rehash_cb'], true) => 'rehash',
            $status === '555' => '555',
            $status === 'la' => 'la',
            $status === 'his' => 'his',
            in_array($status, ['kit', 'kit_ng', 'kit_cb'], true) => 'keep_in_touch',
            in_array($status, ['raw', 'cb', 'naov', 'verify'], true) => 'leads_shop',
            default => null,
        };

        if (
            $status !== 'fresh'
            && $destinationModule !== null
            && ! ManagerAccess::canEdit($request->user(), $destinationModule)
        ) {
            Inertia::flash('toast', [
                'type' => 'error',
                'title' => 'Permission required',
                'message' => 'You do not have permission to move leads to that tab.',
            ]);

            return back();
        }

        $updates = ['status' => $status];
        if ($status === 'fresh' && $isRestrictedActionSource) {
            $updates['rehash_at'] = now();
        }
        if ($lead->status === 'dispatched' && in_array($status, ['kit', 'rehash', 'reschedule'], true)) {
            $updates['appointment_at'] = $followUpAt;
        }
        $manager = $request->user()?->role === 'manager'
            ? $request->user()->manager
            : null;

        if ($status === 'fresh' && $manager) {
            // Returning a lead to Leads Shop always records the acting manager.
            $updates['manager_2_id'] = $manager->manager_id;
        } elseif (
            in_array($status, ['confirmed', 'dispatched', 'kit'], true)
            && $manager
            && ! $lead->manager_2_id
        ) {
            $updates['manager_2_id'] = $manager->manager_id;
        }

        DB::transaction(function () use ($request, $lead, $updates, $appointmentResultNote): void {
            $lead->update($updates);

            if ($appointmentResultNote === '') {
                return;
            }

            $latestBody = $lead->notes()
                ->where('note_type', 'appointment_result')
                ->latest('id')
                ->value('body');

            if ($latestBody !== $appointmentResultNote) {
                $lead->notes()->create([
                    'note_type' => 'appointment_result',
                    'body' => $appointmentResultNote,
                    'created_by' => $request->user()->getAuthIdentifier(),
                ]);
            }
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Lead status updated.']);

        return back();
    }

    public function mergeDuplicate(Request $request, Lead $lead): RedirectResponse
    {
        $canonicalId = $lead->duplicate_of_id;
        abort_unless($canonicalId && $canonicalId < $lead->id, 422, 'This lead is not a resolvable duplicate.');

        DB::transaction(function () use ($lead, $canonicalId): void {
            $duplicate = Lead::query()->lockForUpdate()->findOrFail($lead->id);
            $canonical = Lead::query()->lockForUpdate()->findOrFail($canonicalId);
            abort_unless((int) $duplicate->duplicate_of_id === (int) $canonical->id, 409, 'This duplicate was already resolved.');

            $fillableFromDuplicate = [
                'secondary_number', 'mobile_number', 'email', 'house_age',
                'needs_financing', 'house_value', 'confirmation_notes',
            ];
            $updates = [];
            foreach ($fillableFromDuplicate as $field) {
                if (blank($canonical->{$field}) && filled($duplicate->{$field})) {
                    $updates[$field] = $duplicate->{$field};
                }
            }
            if ($updates !== []) {
                $canonical->update($updates);
            }

            $duplicate->notes()->update(['lead_id' => $canonical->id]);
            if (Schema::hasTable('ringcentral_calls')) {
                $duplicate->ringCentralCalls()->update(['lead_id' => $canonical->id]);
            }
            if (Schema::hasTable('lead_agent_assignments')) {
                $duplicate->agentAssignments()->update(['lead_id' => $canonical->id]);
            }

            Lead::query()->where('duplicate_of_id', $duplicate->id)->update(['duplicate_of_id' => $canonical->id]);
            $duplicate->delete();
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Duplicate merged into the original lead.']);

        return back();
    }

    public function deleteDuplicate(Request $request, Lead $lead): RedirectResponse
    {
        abort_unless($lead->duplicate_of_id && $lead->duplicate_of_id < $lead->id, 422, 'Only the newest duplicate can be deleted.');

        $lead->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Newest duplicate deleted. The original lead was kept.']);

        return back();
    }

    public function assignSalesmen(LeadSalesmenRequest $request, Lead $lead): RedirectResponse
    {
        $data = $request->validated();
        $previousSalesmen = [
            'salesman_1_id' => $lead->salesman_1_id,
            'salesman_2_id' => $lead->salesman_2_id,
        ];

        DB::transaction(function () use ($request, $lead, $data, $previousSalesmen): void {
            $lead->update($data);
            $this->recordSalesmanChanges($request, $lead, $previousSalesmen);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Salesman assignment saved.']);

        return back();
    }

    public function updateAppointmentResult(LeadAppointmentResultRequest $request, Lead $lead): RedirectResponse
    {
        $lead->update($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Appointment result saved.']);

        return back();
    }

    public function sell(LeadSaleRequest $request, Lead $lead): RedirectResponse
    {
        if (! $lead->salesman_1_id && ! $lead->salesman_2_id) {
            throw ValidationException::withMessages([
                'salesman' => 'Assign at least one salesman before accepting a sale.',
            ]);
        }

        $project = DB::transaction(function () use ($request, $lead): Project {
            $project = Project::query()->firstOrNew(['lead_id' => $lead->id]);

            $project->fill([
                'amount' => $request->validated('amount'),
                'status' => 'new',
                'project_number' => null,
                'created_by' => $request->user()->getAuthIdentifier(),
            ])->save();

            $project->sales()->updateOrCreate(
                ['type' => 'original'],
                [
                    'amount' => $request->validated('amount'),
                    'sale_date' => now()->toDateString(),
                    'product_id' => $lead->product_id,
                ],
            );

            if ($lead->status !== 'project') {
                $salesmanNames = Salesman::query()
                    ->whereIn('salesman_id', array_filter([
                        $lead->salesman_1_id,
                        $lead->salesman_2_id,
                    ]))
                    ->pluck('salesman_name', 'salesman_id');

                LeadNote::query()->create([
                    'lead_id' => $lead->id,
                    'note_type' => 'salesman_assignment',
                    'body' => sprintf(
                        'Moved to Projects with Salesman 1: %s; Salesman 2: %s.',
                        $lead->salesman_1_id ? ($salesmanNames[$lead->salesman_1_id] ?? 'Unknown salesman') : 'Unassigned',
                        $lead->salesman_2_id ? ($salesmanNames[$lead->salesman_2_id] ?? 'Unknown salesman') : 'Unassigned',
                    ),
                    'created_by' => $request->user()->getAuthIdentifier(),
                ]);
            }

            $lead->update([
                'status' => 'project',
                'appointment_result' => 'Sold',
            ]);

            return $project;
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Sale accepted and project created.']);

        return to_route('management.projects', ['project' => $project->id]);
    }

    private function appendAgentAssignment(Request $request, Lead $lead, int $agentId): void
    {
        $hasAssignmentHistory = class_exists(LeadAgentAssignment::class)
            && Schema::hasTable('lead_agent_assignments');

        if ($agentId === (int) $lead->agent_id && ! $hasAssignmentHistory) {
            return;
        }

        if ($hasAssignmentHistory) {
            $latestAgentId = (int) (LeadAgentAssignment::query()
                ->where('lead_id', $lead->id)
                ->latest('id')
                ->value('agent_id') ?? $lead->agent_id);

            if ($latestAgentId === $agentId) {
                return;
            }

            LeadAgentAssignment::query()->create([
                'lead_id' => $lead->id,
                'agent_id' => $agentId,
                'assigned_by' => $request->user()->getAuthIdentifier(),
                'is_original' => false,
            ]);
        } elseif ((int) $lead->agent_id === $agentId) {
            return;
        }

        if (! $lead->agent_2_id) {
            $lead->update(['agent_2_id' => $agentId]);
        }

        $agentName = Agent::query()->whereKey($agentId)->value('agent_name') ?? 'Unknown agent';
        LeadNote::query()->create([
            'lead_id' => $lead->id,
            'note_type' => 'agent_reassigned',
            'body' => "Agent reassigned to {$agentName}.",
            'created_by' => $request->user()->getAuthIdentifier(),
        ]);
    }

    /** @param array{salesman_1_id: mixed, salesman_2_id: mixed} $previous */
    private function recordSalesmanChanges(Request $request, Lead $lead, array $previous): void
    {
        $assignments = [
            'salesman_1_id' => 'Salesman 1',
            'salesman_2_id' => 'Salesman 2',
        ];
        $salesmanIds = collect($assignments)
            ->keys()
            ->flatMap(fn (string $field): array => array_filter([
                $previous[$field],
                $lead->{$field},
            ]))
            ->unique()
            ->values();
        $salesmanNames = Salesman::query()
            ->whereIn('salesman_id', $salesmanIds)
            ->pluck('salesman_name', 'salesman_id');

        foreach ($assignments as $field => $slot) {
            $oldId = $previous[$field];
            $newId = $lead->{$field};

            if ((string) $oldId === (string) $newId) {
                continue;
            }

            if ($newId) {
                $body = 'Salesman Sent: '.($salesmanNames[$newId] ?? 'Unknown salesman')." ({$slot})";

                if ($oldId) {
                    $body .= ', replacing '.($salesmanNames[$oldId] ?? 'the previous salesman');
                }

                $noteType = 'salesman_sent';
            } else {
                $body = ($salesmanNames[$oldId] ?? 'Salesman')." removed from {$slot}";
                $noteType = 'salesman_assignment';
            }

            LeadNote::query()->create([
                'lead_id' => $lead->id,
                'note_type' => $noteType,
                'body' => $body.'.',
                'created_by' => $request->user()->getAuthIdentifier(),
            ]);
        }
    }
}
