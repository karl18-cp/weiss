<?php

use App\Models\Account;
use App\Models\Agent;

test('a restricted user lands on their first permitted tab instead of dashboard', function () {
    $account = Account::query()->create([
        'username' => 'restricted-agent@example.com',
        'password' => 'password',
        'role' => 'agent',
    ]);
    $agent = Agent::query()->create([
        'agent_name' => 'Restricted Agent',
        'account_id' => $account->acc_id,
    ]);
    $agent->permissions()->createMany([
        ['module' => 'dashboard', 'access_level' => 'none'],
        ['module' => 'leads_shop', 'access_level' => 'view'],
        ['module' => 'projects', 'access_level' => 'view'],
    ]);

    $this->actingAs($account)
        ->get(route('dashboard'))
        ->assertRedirect('/lead-workflow/leads-shop');
});

test('dashboard remains the landing page when dashboard access is allowed', function () {
    $account = Account::query()->create([
        'username' => 'dashboard-agent@example.com',
        'password' => 'password',
        'role' => 'agent',
    ]);
    $agent = Agent::query()->create([
        'agent_name' => 'Dashboard Agent',
        'account_id' => $account->acc_id,
    ]);
    $agent->permissions()->create([
        'module' => 'dashboard',
        'access_level' => 'view',
    ]);

    $this->actingAs($account)
        ->get(route('dashboard'))
        ->assertOk();
});
