<?php

namespace App\Http\Controllers;

use App\Http\Requests\TeamRequest;
use App\Models\Agent;
use App\Models\Manager;
use App\Models\Team;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class TeamController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('management/teams', [
            'teams' => Team::query()
                ->with([
                    'manager:manager_id,manager_name',
                    'agents' => fn ($query) => $query
                        ->whereNull('agents.inactive_at')
                        ->select(['agents.agent_id', 'agent_name', 'company_id']),
                    'agents.company:com_id,company',
                ])
                ->orderBy('team_name')
                ->get(),
            'managers' => Manager::query()
                ->orderBy('manager_name')
                ->get(['manager_id', 'manager_name']),
            'agents' => Agent::query()
                ->whereNull('inactive_at')
                ->with('company:com_id,company')
                ->orderBy('agent_name')
                ->get(['agent_id', 'agent_name', 'company_id']),
        ]);
    }

    public function store(TeamRequest $request): RedirectResponse
    {
        DB::transaction(function () use ($request): void {
            $data = $request->validated();
            $team = Team::query()->create([
                'team_name' => $data['team_name'],
                'manager_id' => $data['manager_id'],
            ]);
            $team->agents()->sync($data['agent_ids']);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Team created.']);

        return back();
    }

    public function update(TeamRequest $request, Team $team): RedirectResponse
    {
        DB::transaction(function () use ($request, $team): void {
            $data = $request->validated();
            $team->update([
                'team_name' => $data['team_name'],
                'manager_id' => $data['manager_id'],
            ]);
            $team->agents()->sync($data['agent_ids']);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Team updated.']);

        return back();
    }

    public function destroy(Team $team): RedirectResponse
    {

        $team->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Team deleted.']);

        return back();
    }
}
