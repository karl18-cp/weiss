<?php

namespace App\Http\Controllers;

use App\Http\Requests\LeadAppointmentResultRequest;
use App\Http\Requests\LeadNoteRequest;
use App\Http\Requests\LeadRequest;
use App\Http\Requests\LeadSaleRequest;
use App\Http\Requests\LeadSalesmenRequest;
use App\Http\Requests\LeadSecondAgentRequest;
use App\Http\Requests\LeadStatusRequest;
use App\Models\Agent;
use App\Models\Company;
use App\Models\Lead;
use App\Models\LeadAgentAssignment;
use App\Models\LeadNote;
use App\Models\Product;
use App\Models\Project;
use App\Models\Salesman;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class LeadsShopController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('lead-workflow/leads-shop', [
            'leads' => Lead::query()
                ->inLeadsShop()
                ->with([
                    'company:com_id,company,prefix',
                    'product:prod_id,product_name',
                    'agent:agent_id,agent_name',
                    'secondAgent:agent_id,agent_name',
                    'salesmanOne:salesman_id,salesman_name',
                    'salesmanTwo:salesman_id,salesman_name',
                    'notes.creator:acc_id,username',
                    ...(Schema::hasTable('ringcentral_calls')
                        ? ['ringCentralCalls.caller:acc_id,username']
                        : []),
                    ...(Schema::hasTable('lead_movements')
                        ? ['movements.mover:acc_id,username']
                        : []),
                    ...(class_exists(LeadAgentAssignment::class) && Schema::hasTable('lead_agent_assignments')
                        ? [
                            'agentAssignments.agent:agent_id,agent_name',
                            'agentAssignments.assigner:acc_id,username',
                        ]
                        : []),
                ])
                ->latest()
                ->get(),
            'companies' => Company::query()->orderBy('company')->get(['com_id', 'company']),
            'products' => Product::query()->orderBy('product_name')->get(['prod_id', 'product_name']),
            'cities' => Lead::query()
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
            $reassignedAgentId = (int) $data['agent_id'];
            unset($data['agent_id']);
            $previousSalesmen = [
                'salesman_1_id' => $lead->salesman_1_id,
                'salesman_2_id' => $lead->salesman_2_id,
            ];

            $lead->update([
                ...$data,
                'source' => 'CallTools',
            ]);

            $this->recordSalesmanChanges($request, $lead, $previousSalesmen);
            $this->appendAgentAssignment($request, $lead, $reassignedAgentId);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Lead updated.']);

        return back();
    }

    public function storeNote(LeadNoteRequest $request, Lead $lead): RedirectResponse
    {
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
        $lead->update($request->validated());

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
            $project = Project::query()->updateOrCreate(
                ['lead_id' => $lead->id],
                [
                    'amount' => $request->validated('amount'),
                    'created_by' => $request->user()->getAuthIdentifier(),
                ],
            );

            $project->sales()->updateOrCreate(
                ['type' => 'original'],
                [
                    'amount' => $request->validated('amount'),
                    'sale_date' => now()->toDateString(),
                    'product_id' => $lead->product_id,
                ],
            );

            $lead->update([
                'status' => 'project',
                'appointment_result' => 'Sold',
            ]);

            return $project;
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Sale accepted and project created.']);

        return to_route('management.projects', ['project' => $project->id]);
    }

    public function assignSecondAgent(LeadSecondAgentRequest $request, Lead $lead): RedirectResponse
    {
        DB::transaction(fn () => $this->appendAgentAssignment(
            $request,
            $lead,
            (int) $request->validated('agent_2_id'),
        ));
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Agent assignment added.']);

        return back();
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
