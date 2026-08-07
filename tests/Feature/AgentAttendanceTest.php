<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\AgentAttendanceSession;

function attendanceAgent(): array
{
    $account = Account::query()->create(['username' => 'attendance-agent@example.com', 'password' => 'password', 'role' => 'agent']);
    $agent = Agent::query()->create(['agent_name' => 'Attendance Agent', 'account_id' => $account->acc_id]);

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
