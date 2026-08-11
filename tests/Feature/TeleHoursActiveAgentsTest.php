<?php

use App\Models\Account;
use App\Models\Agent;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

test('tele report only lists active contacts and users agents', function () {
    $admin = Account::query()->create([
        'username' => 'tele-active-agents@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $active = Agent::query()->create([
        'agent_name' => 'Active Tele Agent',
        'calltools_user_id' => 'active-tele-agent',
    ]);
    Agent::query()->create([
        'agent_name' => 'Inactive Tele Agent',
        'calltools_user_id' => 'inactive-tele-agent',
        'inactive_at' => now(),
    ]);
    DB::table('calltools_sync_states')->updateOrInsert(
        ['key' => 'login_shifts_last_success_at'],
        ['value' => now()->utc()->toIso8601String(), 'created_at' => now(), 'updated_at' => now()],
    );

    $this->actingAs($admin)
        ->get(route('lead-workflow.tele-hours'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/tele-hours')
            ->has('agentOptions', 1)
            ->where('agentOptions.0.id', $active->agent_id)
            ->has('loginDays', 1)
            ->where('loginDays.0.agent_id', $active->agent_id));
});

