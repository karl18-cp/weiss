<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Lead;
use App\Models\RingCentralCall;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

test('managers can review and listen to recordings from co managers', function () {
    Storage::fake('local');

    $viewer = Account::query()->create([
        'username' => 'recording-viewer-manager@example.com',
        'password' => 'password',
        'role' => 'manager',
    ]);
    $coManager = Account::query()->create([
        'username' => 'recording-coworker-manager@example.com',
        'password' => 'password',
        'role' => 'manager',
    ]);
    $agent = Agent::query()->create(['agent_name' => 'Manager Recording Agent']);
    $lead = Lead::query()->create([
        'customer_name' => 'Manager Recording Lead',
        'marital_status' => 'Unknown',
        'primary_number' => '5551234567',
        'address' => '1 Recording Street',
        'zip_code' => '90001',
        'city' => 'Los Angeles',
        'county' => 'Los Angeles',
        'state' => 'CA',
        'years_in_house' => 1,
        'appointment_at' => now(),
        'telemarketer_notes' => '',
        'source' => 'Test',
        'agent_id' => $agent->agent_id,
        'created_by' => $viewer->acc_id,
        'status' => 'fresh',
    ]);
    $path = 'ringcentral-recordings/test/co-manager-call.mp3';
    Storage::disk('local')->put($path, 'audio bytes');
    $call = RingCentralCall::query()->create([
        'lead_id' => $lead->id,
        'account_id' => $coManager->acc_id,
        'phone_number' => '5551234567',
        'normalized_phone' => '+15551234567',
        'direction' => 'Outbound',
        'result' => 'Accepted',
        'recording_path' => $path,
        'recording_content_type' => 'audio/mpeg',
        'initiated_at' => now(),
    ]);

    $this->actingAs($viewer)
        ->get(route('lead-workflow.call-logs'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/call-logs')
            ->where('isAdmin', true)
            ->has('calls', 1)
            ->where('calls.0.account_id', $coManager->acc_id)
            ->has('users', 1)
            ->where('users.0.acc_id', $coManager->acc_id)
        );

    $this->actingAs($viewer)
        ->get(route('lead-workflow.leads-shop.ringcentral-calls.recording', [$lead, $call]))
        ->assertOk()
        ->assertHeader('content-type', 'audio/mpeg');
});
