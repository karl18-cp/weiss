<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class SalesmanPortalController extends Controller
{
    public function leads(Request $request): Response
    {
        $user = $request->user();
        abort_unless($user?->role === 'salesman', 403);

        $salesmanId = $user->salesman?->salesman_id;
        abort_unless($salesmanId, 403, 'Your account is not linked to a salesman profile.');

        $leads = Lead::query()
            ->where(function ($query) use ($salesmanId): void {
                $query->where('salesman_1_id', $salesmanId)
                    ->orWhere('salesman_2_id', $salesmanId);
            })
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
            ->orderByRaw('appointment_at IS NULL')
            ->orderBy('appointment_at')
            ->orderByDesc('id')
            ->get();

        return Inertia::render('salesman/leads', [
            'leads' => $leads,
            'salesman' => [
                'id' => $salesmanId,
                'name' => $user->salesman->salesman_name,
            ],
        ]);
    }
}
