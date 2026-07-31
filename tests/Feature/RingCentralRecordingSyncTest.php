<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Lead;
use App\Models\RingCentralCall;
use App\Services\RingCentralRecordingSync;
use App\Services\RingCentralService;
use Illuminate\Support\Facades\Storage;

test('newly matched RingCentral recordings are downloaded in the same sync pass', function () {
    Storage::fake('local');
    $account = Account::query()->create([
        'username' => 'recording-sync@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $agent = Agent::query()->create(['agent_name' => 'Recording Sync Agent']);
    $lead = Lead::query()->create([
        'customer_name' => 'Recording Sync Lead',
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
        'created_by' => $account->acc_id,
        'status' => 'fresh',
    ]);
    $call = RingCentralCall::query()->create([
        'lead_id' => $lead->id,
        'account_id' => $account->acc_id,
        'phone_number' => '5551234567',
        'normalized_phone' => '+15551234567',
        'direction' => 'Outbound',
        'initiated_at' => now()->subMinutes(2)->utc(),
    ]);
    $ringCentral = Mockery::mock(RingCentralService::class);
    $ringCentral->shouldReceive('callLog')->once()->andReturn([[
        'id' => 'call-log-1',
        'direction' => 'Outbound',
        'startTime' => $call->initiated_at->toIso8601String(),
        'duration' => 60,
        'result' => 'Accepted',
        'to' => ['phoneNumber' => '+15551234567'],
        'recording' => ['id' => 'recording-1'],
    ]]);
    $ringCentral->shouldReceive('normalizePhoneNumber')
        ->with('+15551234567')
        ->andReturn('+15551234567');
    $ringCentral->shouldReceive('recording')
        ->once()
        ->with('recording-1')
        ->andReturn(['body' => 'audio bytes', 'content_type' => 'audio/mpeg']);

    $result = (new RingCentralRecordingSync($ringCentral))->sync();
    $call->refresh();

    expect($result)
        ->matched->toBe(1)
        ->recordings->toBe(1)
        ->and($call->ringcentral_call_log_id)->toBe('call-log-1')
        ->and($call->recording_id)->toBe('recording-1')
        ->and($call->recording_path)->not->toBeNull();
    Storage::disk('local')->assertExists($call->recording_path);
});
