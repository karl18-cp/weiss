<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use App\Models\Company;
use App\Models\Product;
use App\Models\Project;
use App\Models\Salesman;
use Inertia\Inertia;
use Inertia\Response;

class QualityControlController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('management/quality-control', [
            'projects' => Project::query()
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
            'salesmen' => Salesman::query()->orderBy('salesman_name')->get(['salesman_id', 'salesman_name']),
        ]);
    }
}
