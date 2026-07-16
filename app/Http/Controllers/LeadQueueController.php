<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use App\Models\Company;
use App\Models\Lead;
use App\Models\Product;
use App\Models\Salesman;
use Inertia\Inertia;
use Inertia\Response;

class LeadQueueController extends Controller
{
    public function bookingBoard(): Response
    {
        return Inertia::render('lead-workflow/booking-board', [
            'leads' => Lead::query()
                ->whereIn('status', ['confirmed', 'dispatched'])
                ->with([
                    'company:com_id,company,prefix',
                    'product:prod_id,product_name',
                    'agent:agent_id,agent_name',
                    'secondAgent:agent_id,agent_name',
                    'salesmanOne:salesman_id,salesman_name',
                    'salesmanTwo:salesman_id,salesman_name',
                    'notes:id,lead_id,note_type,body,created_at',
                ])
                ->orderBy('appointment_at')
                ->orderBy('id')
                ->get(),
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
        return $this->renderQueue('lead-workflow/five-five-five', '555');
    }

    public function la(): Response
    {
        return $this->renderQueue('lead-workflow/la', 'la');
    }

    public function his(): Response
    {
        return $this->renderQueue('lead-workflow/his', 'his');
    }

    public function keepInTouch(): Response
    {
        return $this->renderQueue('lead-workflow/keep-in-touch', ['kit', 'kit_ng', 'kit_toss', 'kit_cb']);
    }

    private function renderQueue(string $page, string|array $status): Response
    {
        return Inertia::render($page, [
            'leads' => Lead::query()
                ->whereIn('status', (array) $status)
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
}
