<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\AgentAttendanceSession;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

test('admin can edit and delete a tele hours row while preserving raw imported history', function () {
    $admin = Account::query()->create([
        'username' => 'tele-hours-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $agent = Agent::query()->create([
        'agent_name' => 'Hours Agent',
        'calltools_user_id' => 'hours-agent-1',
    ]);

    DB::table('agent_manual_hours')->insert([
        'agent_id' => $agent->agent_id,
        'work_date' => '2026-08-12',
        'first_login' => '09:00',
        'first_logout' => '17:00',
        'duration_seconds' => 28800,
        'lunch_seconds' => 3600,
        'note' => 'Original note',
        'created_by' => $admin->acc_id,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $this->actingAs($admin)
        ->patch(route('lead-workflow.data.tele-hours.update', [$agent->agent_id, '2026-08-12']), [
            'agent_id' => $agent->agent_id,
            'work_date' => '2026-08-12',
            'calltools_login' => '08:00',
            'calltools_logout' => '18:00',
            'first_login' => '08:30',
            'first_logout' => '17:30',
            'imported_hours' => 9.5,
            'leads_sent' => 7,
            'lunch_hours' => 0.5,
            'note' => 'Updated note',
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('agent_manual_hours', [
        'agent_id' => $agent->agent_id,
        'work_date' => '2026-08-12',
        'duration_seconds' => 32400,
        'imported_seconds_override' => 34200,
        'leads_sent_override' => 7,
        'lunch_seconds' => 1800,
        'note' => 'Updated note',
    ]);

    $this->actingAs($admin)
        ->delete(route('lead-workflow.data.tele-hours.destroy', [$agent->agent_id, '2026-08-12']))
        ->assertRedirect();

    $this->assertDatabaseMissing('agent_manual_hours', [
        'agent_id' => $agent->agent_id,
        'work_date' => '2026-08-12',
    ]);
    $this->assertDatabaseHas('agent_hour_exclusions', [
        'agent_id' => $agent->agent_id,
        'work_date' => '2026-08-12',
    ]);
});

test('imported sessions and a manual override produce one agent day row', function () {
    $admin = Account::query()->create([
        'username' => 'tele-hours-dedupe-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $agent = Agent::query()->create([
        'agent_name' => 'Deduped Agent',
        'calltools_user_id' => 'deduped-user',
    ]);
    foreach ([1, 2] as $session) {
        DB::table('calltools_user_login_shifts')->insert([
            'calltools_id' => "dedupe-session-{$session}",
            'app_user_id' => 'deduped-user',
            'started_at' => "2026-08-12 1{$session}:00:00",
            'stopped_at' => "2026-08-12 1{$session}:30:00",
            'duration_seconds' => 1800,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
    DB::table('agent_manual_hours')->insert([
        'agent_id' => $agent->agent_id,
        'work_date' => '2026-08-12',
        'first_login' => '09:00',
        'first_logout' => '17:00',
        'duration_seconds' => 28800,
        'lunch_seconds' => 3600,
        'created_by' => $admin->acc_id,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $this->actingAs($admin)
        ->get(route('lead-workflow.data.tele-hours', ['date' => '2026-08-12']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('hours', 1)
            ->where('hours.0.agent_id', $agent->agent_id)
            ->where('hours.0.manual_override', true)
            ->where('hours.0.sessions', 2));
});

test('inactive agents remain visible on dates where CallTools recorded a login', function () {
    $admin = Account::query()->create([
        'username' => 'inactive-history-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $inactiveAgent = Agent::query()->create([
        'agent_name' => 'Previously Active Agent',
        'calltools_user_id' => 'historical-inactive-user',
        'inactive_at' => '2026-08-13 00:00:00',
    ]);

    DB::table('calltools_user_login_shifts')->insert([
        'calltools_id' => 'historical-inactive-session',
        'app_user_id' => 'historical-inactive-user',
        'started_at' => '2026-08-12 16:00:00',
        'stopped_at' => '2026-08-12 17:00:00',
        'duration_seconds' => 3600,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $this->actingAs($admin)
        ->get(route('lead-workflow.data.tele-hours', ['date' => '2026-08-12']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('hours', 1)
            ->where('hours.0.agent_id', $inactiveAgent->agent_id)
            ->where('hours.0.agent_name', 'Previously Active Agent')
            ->where('hours.0.sessions', 1)
            ->has('agents', 0));
});

test('data tele hours uses the same effective portal attendance hours as the main tele report', function () {
    $admin = Account::query()->create([
        'username' => 'portal-hours-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $agent = Agent::query()->create([
        'agent_name' => 'Portal Hours Agent',
        'calltools_user_id' => 'portal-hours-agent',
    ]);

    AgentAttendanceSession::query()->create([
        'agent_id' => $agent->agent_id,
        'work_date' => '2026-08-12',
        'clocked_in_at' => '2026-08-12 16:00:00',
        'actual_clocked_in_at' => '2026-08-12 15:30:00',
        'lunch_out_at' => '2026-08-12 20:00:00',
        'actual_lunch_out_at' => '2026-08-12 19:45:00',
        'lunch_in_at' => '2026-08-12 21:00:00',
        'actual_lunch_in_at' => '2026-08-12 21:15:00',
        'clocked_out_at' => '2026-08-13 01:00:00',
        'actual_clocked_out_at' => '2026-08-13 01:20:00',
    ]);

    $this->actingAs($admin)
        ->get(route('lead-workflow.tele-hours', ['date' => '2026-08-12']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('loginDays.0.agent_id', $agent->agent_id)
            ->where('loginDays.0.logged_seconds', 32400)
            ->where('loginDays.0.lunch_seconds', 3600)
            ->where('loginDays.0.attendance_source', 'Agent portal'));

    $this->actingAs($admin)
        ->get(route('lead-workflow.data.tele-hours', ['date' => '2026-08-12']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('hours.0.agent_id', $agent->agent_id)
            ->where('hours.0.imported_seconds', 32400)
            ->where('hours.0.lunch_seconds', 3600)
            ->where('hours.0.total_seconds', 28800)
            ->where('hours.0.attendance_source', 'Agent portal'));
});
