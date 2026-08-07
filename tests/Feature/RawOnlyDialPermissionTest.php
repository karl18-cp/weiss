<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Lead;
use App\Models\Manager;

function dialPermissionLead(Account $creator, Agent $agent, string $status): Lead
{
    return Lead::query()->create([
        'customer_name' => 'Dial Permission Customer '.$status,
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000888',
        'address' => '888 Dial Permission Street',
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
        'status' => $status,
    ]);
}

function dialPermissionManager(bool $restricted): Account
{
    $account = Account::query()->create([
        'username' => 'dial-manager-'.($restricted ? 'restricted' : 'unrestricted'),
        'password' => 'password',
        'role' => 'manager',
    ]);

    Manager::query()->create([
        'manager_name' => $restricted ? 'Restricted Dial Manager' : 'Unrestricted Dial Manager',
        'account_id' => $account->acc_id,
        'phone' => '',
        'manager_types' => [],
    ])->permissions()->createMany([
        ['module' => 'leads_shop', 'access_level' => 'edit'],
        ['module' => 'dial_raw_only', 'access_level' => $restricted ? 'edit' : 'none'],
    ]);

    return $account;
}

test('a raw-only user cannot dial a fresh lead', function () {
    $admin = Account::query()->create([
        'username' => 'dial-test-admin-one',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $lead = dialPermissionLead($admin, Agent::query()->create(['agent_name' => 'Dial Agent One']), 'fresh');

    $this->actingAs(dialPermissionManager(true))
        ->postJson(route('lead-workflow.leads-shop.ringcentral-calls.store', $lead), [
            'phone_slot' => 'primary',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('phone_slot');

    $this->assertDatabaseMissing('ringcentral_calls', ['lead_id' => $lead->id]);
});

test('a raw-only user can dial a raw lead', function () {
    $admin = Account::query()->create([
        'username' => 'dial-test-admin-two',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $lead = dialPermissionLead($admin, Agent::query()->create(['agent_name' => 'Dial Agent Two']), 'raw');

    $this->actingAs(dialPermissionManager(true))
        ->postJson(route('lead-workflow.leads-shop.ringcentral-calls.store', $lead), [
            'phone_slot' => 'primary',
        ])
        ->assertCreated()
        ->assertJsonPath('dial_mode', 'browser_widget');

    $this->assertDatabaseHas('ringcentral_calls', ['lead_id' => $lead->id]);
});

test('an unrestricted user can still dial a fresh lead', function () {
    $admin = Account::query()->create([
        'username' => 'dial-test-admin-three',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $lead = dialPermissionLead($admin, Agent::query()->create(['agent_name' => 'Dial Agent Three']), 'fresh');

    $this->actingAs(dialPermissionManager(false))
        ->postJson(route('lead-workflow.leads-shop.ringcentral-calls.store', $lead), [
            'phone_slot' => 'primary',
        ])
        ->assertCreated();
});
