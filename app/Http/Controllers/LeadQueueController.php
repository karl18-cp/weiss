<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use App\Models\Company;
use App\Models\Lead;
use App\Models\LeadAgentAssignment;
use App\Models\Product;
use App\Models\Salesman;
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
                    'salesmanOne:salesman_id,salesman_name',
                    'salesmanTwo:salesman_id,salesman_name',
                    'notes:id,lead_id,note_type,body,created_at',
                    ...(Schema::hasTable('ringcentral_calls')
                        ? ['ringCentralCalls.caller:acc_id,username']
                        : []),
                ])
                ->orderBy('appointment_at')
                ->orderBy('id')
                ->get(),
            'salesmen' => Salesman::query()
                ->when(
                    $user?->role === 'salesman',
                    fn ($query) => $query->whereKey($salesmanId),
                )
                ->orderBy('salesman_name')
                ->get(['salesman_id', 'salesman_name']),
            'map' => [
                'key' => config('services.maptiler.browser_key'),
                'styleUrl' => 'https://api.maptiler.com/maps/streets-v2/style.json',
            ],
            'viewerRole' => $user?->role,
            'viewerSalesmanId' => $salesmanId,
            'leadBaseUrl' => $user?->role === 'salesman'
                ? '/salesman/leads'
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

    public function toss(): Response
    {
        return $this->renderQueue('lead-workflow/toss-leads', 'toss');
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
                ->whereIn('status', (array) $status)
                ->whereNotNull('city')
                ->where('city', '!=', '')
                ->distinct()
                ->orderBy('city')
                ->pluck('city'),
            'agents' => Agent::query()->orderBy('agent_name')->get(['agent_id', 'agent_name']),
            'salesmen' => Salesman::query()->orderBy('salesman_name')->get(['salesman_id', 'salesman_name']),
        ]);
    }
}
