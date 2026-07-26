<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Lead;
use App\Models\RingCentralCall;
use App\Services\RingCentralService;

function secureRingCentralLead(Account $creator, array $overrides = []): Lead
{
    $agent = Agent::query()->create([
        'agent_name' => 'Secure Call Lead Agent '.uniqid(),
    ]);

    return Lead::query()->create([
        'customer_name' => 'Secure Call Customer',
        'marital_status' => 'Single',
        'primary_number' => '5551234567',
        'address' => '100 Main Street',
        'zip_code' => '90001',
        'city' => 'Los Angeles',
        'county' => 'Los Angeles',
        'state' => 'CA',
        'years_in_house' => 5,
        'telemarketer_notes' => 'Secure call test',
        'source' => 'Test',
        'agent_id' => $agent->agent_id,
        'created_by' => $creator->acc_id,
        'status' => 'fresh',
        ...$overrides,
    ]);
}

test('restricted users can dial a lead without submitting its phone number', function () {
    $account = Account::query()->create([
        'username' => 'restricted-ringcentral-agent',
        'password' => 'password',
        'role' => 'agent',
    ]);
    $agent = Agent::query()->create([
        'account_id' => $account->acc_id,
        'agent_name' => 'Restricted RingCentral Agent',
    ]);
    $agent->permissions()->create([
        'module' => 'leads_shop',
        'access_level' => 'edit',
    ]);
    $lead = secureRingCentralLead($account, [
        'primary_number' => '(555) 123-4567',
    ]);

    $ringCentral = Mockery::mock(RingCentralService::class);
    $ringCentral->shouldReceive('normalizePhoneNumber')
        ->once()
        ->with('(555) 123-4567')
        ->andReturn('+15551234567');
    $ringCentral->shouldReceive('ringOut')
        ->once()
        ->with('(555) 123-4567')
        ->andReturn([
            'id' => 'secure-call-123',
            'status' => ['callStatus' => 'InProgress'],
        ]);
    $this->app->instance(RingCentralService::class, $ringCentral);

    $response = $this->actingAs($account)
        ->from('/lead-workflow/leads-shop')
        ->postJson("/lead-workflow/leads-shop/{$lead->id}/ringcentral-calls", [
            'phone_slot' => 'primary',
        ]);

    $response->assertCreated()
        ->assertJson([
            'dial_mode' => 'secure_ringout',
            'call_id' => 'secure-call-123',
            'display_phone' => '*******567',
            'call_status' => 'InProgress',
        ])
        ->assertJsonMissing(['phone' => '(555) 123-4567']);

    expect(RingCentralCall::query()->first())
        ->phone_number->toBe('(555) 123-4567')
        ->telephony_session_id->toBe('secure-call-123');
});

test('authorized users use the secure dialer and may see the full display number', function () {
    $admin = Account::query()->create([
        'username' => 'ringcentral-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $lead = secureRingCentralLead($admin, [
        'mobile_number' => '5559876543',
    ]);

    $ringCentral = Mockery::mock(RingCentralService::class);
    $ringCentral->shouldReceive('normalizePhoneNumber')
        ->once()
        ->andReturn('+15559876543');
    $ringCentral->shouldReceive('ringOut')
        ->once()
        ->with('5559876543')
        ->andReturn([
            'id' => 'admin-secure-call-456',
            'status' => ['callStatus' => 'InProgress'],
        ]);
    $this->app->instance(RingCentralService::class, $ringCentral);

    $this->actingAs($admin)
        ->postJson("/lead-workflow/leads-shop/{$lead->id}/ringcentral-calls", [
            'phone_slot' => 'mobile',
        ])
        ->assertCreated()
        ->assertJson([
            'dial_mode' => 'secure_ringout',
            'call_id' => 'admin-secure-call-456',
            'display_phone' => '5559876543',
        ]);
});

test('salesmen cannot dial leads that are not assigned to them', function () {
    $account = Account::query()->create([
        'username' => 'unassigned-ringcentral-salesman',
        'password' => 'password',
        'role' => 'salesman',
    ]);
    $salesman = $account->salesman()->create([
        'salesman_name' => 'Unassigned Salesman',
    ]);
    $salesman->permissions()->create([
        'module' => 'leads_shop',
        'access_level' => 'edit',
    ]);
    $lead = secureRingCentralLead($account, ['primary_number' => '5551234567']);

    $this->actingAs($account)
        ->from('/lead-workflow/leads-shop')
        ->postJson("/lead-workflow/leads-shop/{$lead->id}/ringcentral-calls", [
            'phone_slot' => 'primary',
        ])
        ->assertNotFound();
});
