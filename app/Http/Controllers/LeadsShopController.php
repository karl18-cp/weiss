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
use App\Models\LeadNote;
use App\Models\Product;
use App\Models\Project;
use App\Models\Salesman;
use App\Services\ProjectNumberAllocator;
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
    public function latestMarker(): JsonResponse
    {
        $latestLead = Lead::query()
            ->inLeadsShop()
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
            : 'leads.appointment_at';

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

        $dateRows = (clone $queueQuery)
            ->whereNotNull($dateField)
            ->selectRaw("{$dateExpression} as date_value")
            ->get()
            ->pluck('date_value')
            ->filter()
            ->map(fn ($value): string => $dateField === 'created_at'
                ? CarbonImmutable::parse((string) $value, 'UTC')->setTimezone($crmTimezone)->toDateString()
                : substr((string) $value, 0, 10))
            ->countBy()
            ->sortKeysDesc()
            ->map(fn (int $count, string $date): array => [
                'key' => $date,
                'count' => $count,
            ])
            ->values();

        $requestedLeadDate = $requestedLeadId
            ? (clone $queueQuery)
                ->whereKey($requestedLeadId)
                ->selectRaw("{$dateExpression} as date_value")
                ->first()?->date_value
            : null;
        $requestedDateKey = $requestedLeadDate
            ? ($dateField === 'created_at'
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

        $createdDayQuery = Lead::query()
            // Use the same scored population as TeamDashboardController. A
            // legacy CallTools lead can predate provider contact IDs, while
            // direct projects assigned outside a team must not inflate this
            // operational count.
            ->whereIn('agent_id', DB::table('agent_team')->select('agent_id')->distinct())
            ->whereNotNull('created_at')
            ->whereBetween(DB::raw($effectiveCreatedAtExpression), [$createdFrom, $createdTo]);
        $createdDayTotal = (clone $createdDayQuery)->count();
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
                    $selectedCity !== '' && $selectedCity !== 'all',
                    fn ($query) => $query->where('city', $selectedCity),
                    fn ($query) => $query->when(
                        $selectedDate,
                        fn ($query) => $dateField === 'created_at'
                            ? $query->whereBetween(DB::raw($effectiveCreatedAtExpression), [$createdFrom, $createdTo])
                            : $query->whereDate('appointment_at', $selectedDate),
                        fn ($query) => $query->whereRaw('1 = 0'),
                    ),
                )
                ->with([
                    'company:com_id,company,prefix',
                    'product:prod_id,product_name',
                    'agent:agent_id,agent_name',
                    'secondAgent:agent_id,agent_name',
                    'secondManager:manager_id,manager_name',
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
                ->get(),
            'dateRows' => $dateRows,
            'selectedDate' => $selectedDate,
            'selectedCity' => $selectedCity !== '' ? $selectedCity : 'all',
            'dateField' => $dateField,
            'timezoneOffset' => (int) ($selectedCaliforniaDay->utcOffset() / 60),
            'movementDestinations' => $movementDestinations,
            'createdDayTotal' => $createdDayTotal,
            'companies' => Company::query()->orderBy('company')->get(['com_id', 'company']),
            'products' => Product::query()->orderBy('product_name')->get(['prod_id', 'product_name']),
            'cities' => Lead::query()
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

    public function update(LeadRequest $request, Lead $lead): RedirectResponse
    {
        DB::transaction(function () use ($request, $lead): void {
            $data = $request->validated();
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
        abort_if($lead->project()->exists(), 422, 'Project leads cannot be deleted.');

        $lead->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Sample lead deleted.']);

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
        $appointmentResultNote = trim((string) ($validated['appointment_result_note'] ?? ''));

        if ($status === 'toss' && ! ManagerAccess::canEdit($request->user(), 'toss_action')) {
            Inertia::flash('toast', [
                'type' => 'error',
                'title' => 'Permission required',
                'message' => 'You do not have permission to move leads to TOSS.',
            ]);

            return back();
        }

        $updates = ['status' => $status];
        $manager = $request->user()?->role === 'manager'
            ? $request->user()->manager
            : null;

        if (
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

            if (! $project->exists) {
                $project->project_number = app(ProjectNumberAllocator::class)->allocate($lead);
            }

            $project->fill([
                'amount' => $request->validated('amount'),
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
