<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use Inertia\Inertia;
use Inertia\Response;

class TeleHoursController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('lead-workflow/tele-hours', [
            'agents' => Agent::query()
                ->withCount('leads')
                ->orderBy('agent_name')
                ->get()
                ->map(fn (Agent $agent) => [
                    'id' => $agent->agent_id,
                    'name' => $agent->agent_name,
                    'leads_count' => $agent->leads_count,
                    'hours' => [
                        'mon' => 0,
                        'tue' => 0,
                        'wed' => 0,
                        'thu' => 0,
                        'fri' => 0,
                        'sat' => 0,
                    ],
                ]),
        ]);
    }
}
