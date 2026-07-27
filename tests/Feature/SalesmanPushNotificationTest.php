<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Lead;
use App\Models\PushNotificationLog;
use App\Models\PushSubscription;
use App\Models\Salesman;
use App\Services\WebPushService;

function pushTestLead(Account $creator, Agent $agent, array $attributes = []): Lead
{
    return Lead::query()->create([
        'customer_name' => 'Push Test Customer',
        'marital_status' => 'Single',
        'primary_number' => '555-0100',
        'address' => '100 Main Street',
        'zip_code' => '90001',
        'city' => 'Los Angeles',
        'county' => 'Los Angeles',
        'state' => 'CA',
        'years_in_house' => 5,
        'appointment_at' => now()->addMinutes(20),
        'telemarketer_notes' => 'Push test',
        'source' => 'Test',
        'agent_id' => $agent->agent_id,
        'created_by' => $creator->acc_id,
        'status' => 'dispatched',
        ...$attributes,
    ]);
}

function pushTestUsers(): array
{
    $admin = Account::query()->create([
        'username' => 'push-admin@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $agentAccount = Account::query()->create([
        'username' => 'push-agent@example.com',
        'password' => 'password',
        'role' => 'agent',
    ]);
    $agent = Agent::query()->create([
        'agent_name' => 'Push Agent',
        'account_id' => $agentAccount->acc_id,
    ]);
    $salesmanAccount = Account::query()->create([
        'username' => 'push-recipient@example.com',
        'password' => 'password',
        'role' => 'salesman',
    ]);
    $salesman = Salesman::query()->create([
        'salesman_name' => 'Push Recipient',
        'account_id' => $salesmanAccount->acc_id,
    ]);

    return compact('admin', 'agent', 'salesmanAccount', 'salesman');
}

test('dispatch salesman assignment sends an immediate push notification', function () {
    extract(pushTestUsers());
    $lead = pushTestLead($admin, $agent);
    $push = Mockery::mock(WebPushService::class);
    $push->shouldReceive('sendToAccount')
        ->once()
        ->with(
            $salesmanAccount->acc_id,
            'New lead assigned',
            Mockery::type('string'),
            "/salesman/leads?lead={$lead->id}",
        )
        ->andReturn(1);
    app()->instance(WebPushService::class, $push);

    $this->actingAs($admin)
        ->patch(route('lead-workflow.leads-shop.salesmen.update', $lead), [
            'salesman_1_id' => $salesman->salesman_id,
            'salesman_2_id' => null,
        ])
        ->assertRedirect();
});

test('scheduler sends same-day and upcoming appointment reminders only once', function () {
    extract(pushTestUsers());
    $lead = pushTestLead($admin, $agent, [
        'salesman_1_id' => $salesman->salesman_id,
    ]);
    PushSubscription::query()->create([
        'account_id' => $salesmanAccount->acc_id,
        'endpoint' => 'https://push.example.test/reminder-device',
        'public_key' => 'public-key',
        'auth_token' => 'auth-token',
        'content_encoding' => 'aes128gcm',
    ]);
    $push = Mockery::mock(WebPushService::class);
    $push->shouldReceive('sendToAccount')->twice()->andReturn(1);
    app()->instance(WebPushService::class, $push);

    $this->artisan('push:appointment-reminders')->assertSuccessful();
    $this->artisan('push:appointment-reminders')->assertSuccessful();

    expect(PushNotificationLog::query()->where('lead_id', $lead->id)->count())
        ->toBe(2);
});
