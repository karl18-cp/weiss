<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use App\Models\AgentSchedule;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class AgentScheduleController extends Controller
{
    public function index(): Response
    {
        $activeAgents = Agent::query()->whereNull('inactive_at');
        $templateAgent = (clone $activeAgents)
            ->whereHas('schedules')
            ->with('schedules')
            ->orderByDesc(
                AgentSchedule::query()
                    ->select('updated_at')
                    ->whereColumn('agent_id', 'agents.agent_id')
                    ->latest('updated_at')
                    ->limit(1),
            )
            ->first();

        return Inertia::render('management/agent-schedules', [
            'schedules' => $templateAgent?->schedules
                ->keyBy('weekday')
                ->map->only(['weekday', 'is_working', 'shift_start', 'shift_end', 'lunch_start', 'lunch_end'])
                ?? collect(),
            'activeAgentCount' => (clone $activeAgents)->count(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $data=$request->validate(['schedules'=>'required|array|size:7','schedules.*.weekday'=>'required|integer|between:0,6','schedules.*.is_working'=>'required|boolean','schedules.*.shift_start'=>'nullable|required_if:schedules.*.is_working,true|date_format:H:i','schedules.*.shift_end'=>'nullable|required_if:schedules.*.is_working,true|date_format:H:i','schedules.*.lunch_start'=>'nullable|required_if:schedules.*.is_working,true|date_format:H:i','schedules.*.lunch_end'=>'nullable|required_if:schedules.*.is_working,true|date_format:H:i']);
        DB::transaction(function()use($data):void{
            Agent::query()->whereNull('inactive_at')->pluck('agent_id')->each(function ($agentId) use ($data): void {
                foreach($data['schedules'] as $row){
                    AgentSchedule::query()->updateOrCreate(['agent_id'=>$agentId,'weekday'=>$row['weekday']],$row);
                }
            });
        });
        return back()->with('success','Shared schedule saved for every active agent.');
    }
}
