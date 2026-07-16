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
use App\Models\LeadNote;
use App\Models\Product;
use App\Models\Project;
use App\Models\Salesman;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class LeadsShopController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('lead-workflow/leads-shop', [
            'leads' => Lead::query()
                ->with([
                    'company:com_id,company,prefix',
                    'product:prod_id,product_name',
                    'agent:agent_id,agent_name',
                    'secondAgent:agent_id,agent_name',
                    'salesmanOne:salesman_id,salesman_name',
                    'salesmanTwo:salesman_id,salesman_name',
                    'notes.creator:acc_id,username',
                ])
                ->latest()
                ->get(),
            'companies' => Company::query()->orderBy('company')->get(['com_id', 'company']),
            'products' => Product::query()->orderBy('product_name')->get(['prod_id', 'product_name']),
            'agents' => Agent::query()->orderBy('agent_name')->get(['agent_id', 'agent_name']),
            'salesmen' => Salesman::query()->orderBy('salesman_name')->get(['salesman_id', 'salesman_name']),
        ]);
    }

    public function update(LeadRequest $request, Lead $lead): RedirectResponse
    {
        $lead->update([
            ...$request->validated(),
            'source' => 'CallTools',
        ]);

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
        $lead->update($request->validated());

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

        DB::transaction(function () use ($request, $lead): void {
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
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Sale accepted and project created.']);

        return back();
    }

    public function assignSecondAgent(LeadSecondAgentRequest $request, Lead $lead): RedirectResponse
    {
        $lead->update($request->validated());
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Second agent saved.']);

        return back();
    }
}
