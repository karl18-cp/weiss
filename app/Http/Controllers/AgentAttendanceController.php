<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use App\Models\AgentAttendanceSession;
use App\Models\AgentSchedule;
use App\Models\Lead;
use App\Support\AgentAttendanceHours;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AgentAttendanceController extends Controller
{
    private const TIMEZONE = 'America/Los_Angeles';

    public function __construct(private readonly AgentAttendanceHours $attendanceHours) {}

    public function index(Request $request): Response
    {
        $agent = $this->agent($request); $timezone = self::TIMEZONE; $now = $this->now();
        try { $scoreDate = CarbonImmutable::parse($request->string('date')->toString() ?: 'today', $timezone)->startOfDay(); } catch (\Throwable) { $scoreDate = CarbonImmutable::today($timezone); }
        $scoreFrom = $scoreDate->utc(); $scoreTo = $scoreDate->endOfDay()->utc();
        $schedule = $this->sharedSchedule($now->dayOfWeek);
        $open = $agent->attendanceSessions()->whereNull('clocked_out_at')->latest('clocked_in_at')->first();
        $today = $agent->attendanceSessions()->where('work_date', $now->toDateString())->get();
        $createdExpression = Schema::hasTable('lead_movements') ? 'COALESCE((SELECT MIN(lm.created_at) FROM lead_movements lm WHERE lm.lead_id = leads.id), leads.created_at)' : 'leads.created_at';
        $dailyLeads = Lead::query()->where('agent_id', $agent->agent_id)->whereBetween(DB::raw($createdExpression), [$scoreFrom, $scoreTo]);
        $sold = Lead::query()->where('agent_id', $agent->agent_id)->where('status', 'project')->whereHas('project')->whereBetween('appointment_at', [$scoreDate->format('Y-m-d H:i:s'), $scoreDate->endOfDay()->format('Y-m-d H:i:s')])->count();
        $teamScores = $agent->teams()->with(['agents:agents.agent_id,agent_name'])->get()->map(function ($team) use ($createdExpression, $scoreFrom, $scoreTo, $scoreDate): array {
            $ids=$team->agents->pluck('agent_id'); $leads=Lead::query()->whereIn('agent_id',$ids)->whereBetween(DB::raw($createdExpression),[$scoreFrom,$scoreTo]);
            return ['id'=>$team->team_id,'name'=>$team->team_name,'total'=>(clone $leads)->count(),'confirmed'=>(clone $leads)->whereIn('status',['confirmed','dispatched'])->count(),'sold'=>Lead::query()->whereIn('agent_id',$ids)->where('status','project')->whereHas('project')->whereBetween('appointment_at',[$scoreDate->format('Y-m-d H:i:s'),$scoreDate->endOfDay()->format('Y-m-d H:i:s')])->count()];
        });

        return Inertia::render('agent/dashboard', [
            'agent' => ['id' => $agent->agent_id, 'name' => $agent->agent_name],
            'schedule' => $schedule ? $schedule->only(['is_working', 'shift_start', 'shift_end', 'lunch_start', 'lunch_end']) : null,
            'openSession' => $open ? $this->session($open, $now) : null,
            'todaySeconds' => $today->sum(fn ($item) => $this->netSeconds($item, $now)),
            'recentSessions' => $agent->attendanceSessions()->latest('clocked_in_at')->limit(10)->get()->map(fn ($item) => $this->session($item, $now)),
            'scoreDate'=>$scoreDate->toDateString(), 'todayDate'=>CarbonImmutable::today($timezone)->toDateString(), 'timezone'=>$timezone,
            'leadSummary' => ['total'=>(clone $dailyLeads)->count(),'confirmed'=>(clone $dailyLeads)->whereIn('status',['confirmed','dispatched'])->count(),'sold'=>$sold],
            'recentLeads' => (clone $dailyLeads)->orderByRaw($createdExpression.' desc')->limit(50)->get(['id','customer_name','city'])->map(fn($lead)=>['id'=>$lead->id,'customer'=>$lead->customer_name,'city'=>$lead->city]),
            'teamScores'=>$teamScores,
            'serverNow' => $now->toIso8601String(),
        ]);
    }

    public function clockIn(Request $request): RedirectResponse
    {
        $agent=$this->agent($request); $now=$this->now(); $schedule=$this->schedule($agent,$now);
        $created=DB::transaction(function () use ($agent,$now,$schedule): bool {
            if (AgentAttendanceSession::query()->where('agent_id',$agent->agent_id)->whereNull('clocked_out_at')->lockForUpdate()->exists()) return false;
            $start=$this->scheduled($now,$schedule->shift_start);
            AgentAttendanceSession::query()->create(['agent_id'=>$agent->agent_id,'work_date'=>$now->toDateString(),'actual_clocked_in_at'=>$now,'clocked_in_at'=>$now->lessThan($start)?$start:$now]); return true;
        });
        return back()->with($created?'success':'info',$created?'You are clocked in.':'You already have an open shift.');
    }

    public function lunchOut(Request $request): RedirectResponse { return $this->punch($request,'lunch_out_at','actual_lunch_out_at','lunch_start','Lunch started.'); }
    public function lunchIn(Request $request): RedirectResponse
    {
        $agent=$this->agent($request); $session=$agent->attendanceSessions()->whereNull('clocked_out_at')->latest()->first();
        if (!$session?->lunch_out_at) throw ValidationException::withMessages(['attendance'=>'Start lunch before returning from lunch.']);
        return $this->punch($request,'lunch_in_at','actual_lunch_in_at','lunch_end','Welcome back.');
    }

    public function clockOut(Request $request): RedirectResponse
    {
        $agent=$this->agent($request); $now=$this->now(); $schedule=$this->schedule($agent,$now);
        $closed=DB::transaction(function () use ($agent,$now,$schedule): bool {
            $session=AgentAttendanceSession::query()->where('agent_id',$agent->agent_id)->whereNull('clocked_out_at')->lockForUpdate()->latest()->first(); if(!$session)return false;
            $end=$this->scheduledForWorkDate($session->work_date, $schedule->shift_end); $values=['actual_clocked_out_at'=>$now,'clocked_out_at'=>$end->lessThan($session->clocked_in_at)?$session->clocked_in_at:$end];
            if($session->lunch_out_at&&!$session->lunch_in_at){$values['actual_lunch_in_at']=$now;$lunchEnd=$this->scheduledForWorkDate($session->work_date,$schedule->lunch_end);$values['lunch_in_at']=$lunchEnd->greaterThan($end)?$end:$lunchEnd;}
            $session->update($values); return true;
        });
        return back()->with($closed?'success':'info',$closed?'You are clocked out.':'There is no open shift.');
    }

    private function punch(Request $request,string $effective,string $actual,string $scheduleField,string $message): RedirectResponse
    {
        $agent=$this->agent($request);$now=$this->now();$schedule=$this->schedule($agent,$now);
        DB::transaction(function () use($agent,$now,$schedule,$effective,$actual,$scheduleField):void{$session=AgentAttendanceSession::query()->where('agent_id',$agent->agent_id)->whereNull('clocked_out_at')->lockForUpdate()->latest()->first();if(!$session)throw ValidationException::withMessages(['attendance'=>'Clock in before using lunch controls.']);if($session->{$effective})throw ValidationException::withMessages(['attendance'=>'This attendance action was already recorded.']);$scheduled=$this->scheduledForWorkDate($session->work_date,$schedule->{$scheduleField});$session->update([$actual=>$now,$effective=>$now->lessThan($scheduled)?$scheduled:$now]);});
        return back()->with('success',$message);
    }

    private function schedule(Agent $agent,$now)
    {
        $schedule=$this->sharedSchedule($now->dayOfWeek);
        if(!$schedule?->is_working||!$schedule->shift_start||!$schedule->shift_end||!$schedule->lunch_start||!$schedule->lunch_end)throw ValidationException::withMessages(['attendance'=>'No complete working schedule is assigned for today.']); return $schedule;
    }
    private function sharedSchedule(int $weekday): ?AgentSchedule{return AgentSchedule::query()->where('weekday',$weekday)->latest('updated_at')->latest('id')->first();}
    private function now(): CarbonImmutable{return CarbonImmutable::now(self::TIMEZONE);}
    private function scheduled($now,string $time): CarbonImmutable{return CarbonImmutable::parse($now->toDateString().' '.$time,self::TIMEZONE);}
    private function scheduledForWorkDate($workDate,string $time): CarbonImmutable{return CarbonImmutable::parse(CarbonImmutable::parse($workDate,self::TIMEZONE)->toDateString().' '.$time,self::TIMEZONE);}
    private function netSeconds($session,$now):int{return $this->attendanceHours->netSeconds($session,$now);}
    private function session($session,$now):array{return ['id'=>$session->id,'work_date'=>$session->work_date?->toDateString(),'clocked_in_at'=>$session->clocked_in_at->toIso8601String(),'clocked_out_at'=>$session->clocked_out_at?->toIso8601String(),'lunch_out_at'=>$session->lunch_out_at?->toIso8601String(),'lunch_in_at'=>$session->lunch_in_at?->toIso8601String(),'duration_seconds'=>$this->netSeconds($session,$now)];}
    private function agent(Request $request):Agent{$user=$request->user();abort_unless($user?->role==='agent',403,'This workspace is for agent accounts only.');$agent=$user->agent;abort_unless($agent,403,'Your account is not linked to an agent profile.');return $agent;}
}
