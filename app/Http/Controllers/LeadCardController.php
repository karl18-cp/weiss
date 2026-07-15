<?php

namespace App\Http\Controllers;

use App\Http\Requests\LeadRequest;
use App\Models\Agent;
use App\Models\Company;
use App\Models\Lead;
use App\Models\LeadNote;
use App\Models\Product;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class LeadCardController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('lead-workflow/lead-card', [
            'companies' => Company::query()->orderBy('company')->get(['com_id', 'company']),
            'products' => Product::query()->orderBy('product_name')->get(['prod_id', 'product_name']),
            'agents' => Agent::query()->orderBy('agent_name')->get(['agent_id', 'agent_name']),
        ]);
    }

    public function store(LeadRequest $request): RedirectResponse
    {
        DB::transaction(function () use ($request): void {
            $lead = Lead::query()->create([
                ...$request->validated(),
                'source' => 'CallTools',
                'created_by' => $request->user()->getAuthIdentifier(),
            ]);

            LeadNote::query()->create([
                'lead_id' => $lead->id,
                'note_type' => 'telemarketer',
                'body' => $request->validated('telemarketer_notes'),
                'created_by' => $request->user()->getAuthIdentifier(),
            ]);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Lead created.']);

        return back();
    }
}
