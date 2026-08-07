<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Lead;
use App\Models\Manager;

function tossPermissionLead(Account $creator, Agent $agent): Lead
{
    return Lead::query()->create([
        'customer_name' => 'TOSS Permission Customer',
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000777',
        'address' => '777 Permission Street',
        'zip_code' => '90001',
        'city' => 'Los Angeles',
        'county' => '',
        'state' => 'CA',
        'years_in_house' => 0,
        'appointment_at' => now()->addDay(),
        'telemarketer_notes' => '',
        'source' => 'Manual',
        'agent_id' => $agent->agent_id,
        'created_by' => $creator->acc_id,
        'status' => 'confirmed',
    ]);
}

test('a manager without the toss action permission cannot move a lead to toss', function () {
    $admin = Account::query()->create([
        'username' => 'toss-permission-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $account = Account::query()->create([
        'username' => 'toss-denied-manager',
        'password' => 'password',
        'role' => 'manager',
    ]);
    Manager::query()->create([
        'manager_name' => 'Denied Manager',
        'account_id' => $account->acc_id,
        'phone' => '',
        'manager_types' => [],
    ])->permissions()->createMany([
        ['module' => 'leads_shop', 'access_level' => 'edit'],
        ['module' => 'toss_action', 'access_level' => 'none'],
    ]);
    $lead = tossPermissionLead($admin, Agent::query()->create(['agent_name' => 'Permission Agent']));

    $this->actingAs($account)
        ->patch(route('lead-workflow.leads-shop.status.update', $lead), ['status' => 'toss'])
        ->assertRedirect();

    expect($lead->fresh()->status)->toBe('confirmed');
});

test('a manager with the toss action permission can move a lead to toss', function () {
    $admin = Account::query()->create([
        'username' => 'toss-allowed-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $account = Account::query()->create([
        'username' => 'toss-allowed-manager',
        'password' => 'password',
        'role' => 'manager',
    ]);
    Manager::query()->create([
        'manager_name' => 'Allowed Manager',
        'account_id' => $account->acc_id,
        'phone' => '',
        'manager_types' => [],
    ])->permissions()->createMany([
        ['module' => 'leads_shop', 'access_level' => 'edit'],
        ['module' => 'toss_action', 'access_level' => 'edit'],
    ]);
    $lead = tossPermissionLead($admin, Agent::query()->create(['agent_name' => 'Allowed Permission Agent']));

    $this->actingAs($account)
        ->patch(route('lead-workflow.leads-shop.status.update', $lead), ['status' => 'toss'])
        ->assertRedirect();

    expect($lead->fresh()->status)->toBe('toss');
});
