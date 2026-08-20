<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\AgentAttendanceSession;
use App\Models\AgentSchedule;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

function attendanceAgent(): array
{
    $account = Account::query()->create(['username' => 'attendance-agent@example.com', 'password' => 'password', 'role' => 'agent']);
    $agent = Agent::query()->create(['agent_name' => 'Attendance Agent', 'account_id' => $account->acc_id]);
    AgentSchedule::query()->create(['agent_id'=>$agent->agent_id,'weekday'=>now()->dayOfWeek,'is_working'=>true,'shift_start'=>'09:00','shift_end'=>'18:00','lunch_start'=>'13:00','lunch_end'=>'14:00']);

    return [$account, $agent];
}

test('agent accounts are directed to their time clock workspace', function () {
    [$account] = attendanceAgent();

    $this->actingAs($account)->get('/dashboard')->assertRedirect('/agent/dashboard');
    $this->actingAs($account)->get('/agent/dashboard')->assertOk()
        ->assertInertia(fn ($page) => $page->component('agent/dashboard')->where('openSession', null));
});

test('an agent can time in only once and then time out', function () {
    [$account, $agent] = attendanceAgent();

    $this->actingAs($account)->post('/agent/time-in')->assertRedirect();
    $this->actingAs($account)->post('/agent/time-in')->assertRedirect();

    expect(AgentAttendanceSession::query()->where('agent_id', $agent->agent_id)->count())->toBe(1);
    expect(AgentAttendanceSession::query()->where('agent_id', $agent->agent_id)->whereNull('clocked_out_at')->count())->toBe(1);

    $this->actingAs($account)->post('/agent/time-out')->assertRedirect();
    expect(AgentAttendanceSession::query()->where('agent_id', $agent->agent_id)->whereNull('clocked_out_at')->count())->toBe(0);
});

test('non agent accounts cannot use the agent time clock', function () {
    $admin = Account::query()->create(['username' => 'attendance-admin@example.com', 'password' => 'password', 'role' => 'admin']);

    $this->actingAs($admin)->get('/agent/dashboard')->assertForbidden();
    $this->actingAs($admin)->post('/agent/time-in')->assertForbidden();
});

test('attendance always uses the California workday when the server timezone is different', function () {
    config(['app.timezone' => 'Asia/Manila']);
    $this->travelTo(CarbonImmutable::parse('2026-08-16 06:30:00', 'UTC'));

    $account = Account::query()->create([
        'username' => 'california-attendance-agent@example.com',
        'password' => 'password',
        'role' => 'agent',
    ]);
    $agent = Agent::query()->create([
        'agent_name' => 'California Attendance Agent',
        'account_id' => $account->acc_id,
    ]);
    AgentSchedule::query()->create([
        'agent_id' => $agent->agent_id,
        'weekday' => 6,
        'is_working' => true,
        'shift_start' => '09:00',
        'shift_end' => '18:00',
        'lunch_start' => '13:00',
        'lunch_end' => '14:00',
    ]);

    $this->actingAs($account)->get('/agent/dashboard')
        ->assertInertia(fn (Assert $page) => $page
            ->where('todayDate', '2026-08-15')
            ->where('schedule.is_working', true));

    $this->actingAs($account)->post('/agent/time-in')->assertRedirect();

    expect((string) AgentAttendanceSession::query()->where('agent_id', $agent->agent_id)->value('work_date'))
        ->toBe('2026-08-15');
});
