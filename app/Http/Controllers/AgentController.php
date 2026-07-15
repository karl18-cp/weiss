<?php

namespace App\Http\Controllers;

use App\Http\Requests\AgentRequest;
use App\Models\Agent;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class AgentController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('management/agents', [
            'agents' => Agent::query()->orderBy('agent_name')->get(),
        ]);
    }

    public function store(AgentRequest $request): RedirectResponse
    {
        Agent::query()->create($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Agent created.']);

        return back();
    }

    public function update(AgentRequest $request, Agent $agent): RedirectResponse
    {
        $agent->update($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Agent updated.']);

        return back();
    }

    public function destroy(Agent $agent): RedirectResponse
    {
        abort_unless(request()->user()?->role === 'admin', 403);

        $agent->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Agent deleted.']);

        return back();
    }
}
