<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use App\Models\Company;
use App\Models\Product;
use App\Models\Project;
use App\Models\Salesman;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class QualityControlController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('management/quality-control', [
            'projects' => Project::query()
                ->where('status', '!=', 'canceled')
                ->with([
                    'lead.company:com_id,company,prefix',
                    'lead.product:prod_id,product_name',
                    'lead.agent:agent_id,agent_name',
                    'lead.secondAgent:agent_id,agent_name',
                    'lead.salesmanOne:salesman_id,salesman_name',
                    'lead.salesmanTwo:salesman_id,salesman_name',
                    'lead.notes.creator:acc_id,username',
                ])
                ->latest()
                ->get(),
            'companies' => Company::query()->whereNull('archived_at')->orderBy('company')->get(['com_id', 'company']),
            'products' => Product::query()->orderBy('product_name')->get(['prod_id', 'product_name']),
            'agents' => Agent::query()->orderBy('agent_name')->get(['agent_id', 'agent_name']),
            'salesmen' => Salesman::query()->whereNull('inactive_at')->orderBy('salesman_name')->get(['salesman_id', 'salesman_name']),
        ]);
    }

    public function returnToDispatch(Project $project): RedirectResponse
    {
        $userId = request()->user()->getAuthIdentifier();

        DB::transaction(function () use ($project, $userId): void {
            $lead = $project->lead()->lockForUpdate()->firstOrFail();
            $projectNumber = $project->project_number;

            $project->update(['status' => 'canceled']);
            $lead->update(['status' => 'dispatched']);
            $lead->notes()->create([
                'note_type' => 'quality_control',
                'body' => 'Returned to Dispatch from Quality Control'.($projectNumber ? " (project {$projectNumber})" : '').'. The project record was preserved as canceled.',
                'created_by' => $userId,
            ]);
        });

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Lead returned to Dispatch. The project was preserved as canceled.',
        ]);

        return redirect()->route('management.quality-control');
    }
}
