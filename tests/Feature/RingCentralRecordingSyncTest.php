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
        ->checked->toBe(1)
        ->matched->toBe(1)
        ->recordings->toBe(1)
        ->and($call->ringcentral_call_log_id)->toBe('call-log-1')
        ->and($call->recording_id)->toBe('recording-1')
        ->and($call->sync_checked_at)->not->toBeNull()
        ->and($call->recording_path)->not->toBeNull();
    Storage::disk('local')->assertExists($call->recording_path);

    $secondPass = (new RingCentralRecordingSync($ringCentral))->sync();
    expect($secondPass)->checked->toBe(0)->matched->toBe(0)->recordings->toBe(0);
});

test('matched calls are checked again when RingCentral publishes recording metadata later', function () {
    Storage::fake('local');
    $account = Account::query()->create([
        'username' => 'delayed-recording@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $agent = Agent::query()->create(['agent_name' => 'Delayed Recording Agent']);
    $lead = Lead::query()->create([
        'customer_name' => 'Delayed Recording Lead',
        'marital_status' => 'Unknown',
        'primary_number' => '5559876543',
        'address' => '2 Recording Street',
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
        'phone_number' => '5559876543',
        'normalized_phone' => '+15559876543',
        'direction' => 'Outbound',
        'ringcentral_call_log_id' => 'delayed-call-log-1',
        'result' => 'Accepted',
        'duration_seconds' => 90,
        'initiated_at' => now()->subMinutes(10)->utc(),
        'started_at' => now()->subMinutes(10)->utc(),
        'ended_at' => now()->subMinutes(8)->utc(),
        'matched_at' => now()->subMinutes(9)->utc(),
        'sync_checked_at' => now()->subMinutes(6)->utc(),
    ]);

    $ringCentral = Mockery::mock(RingCentralService::class);
    $ringCentral->shouldReceive('callLog')->once()->andReturn([[
        'id' => 'delayed-call-log-1',
        'direction' => 'Outbound',
        'startTime' => $call->initiated_at->toIso8601String(),
        'duration' => 90,
        'result' => 'Accepted',
        'to' => ['phoneNumber' => '+15559876543'],
        'recording' => ['id' => 'delayed-recording-1'],
    ]]);
    $ringCentral->shouldReceive('recording')
        ->once()
        ->with('delayed-recording-1')
        ->andReturn(['body' => 'delayed audio bytes', 'content_type' => 'audio/mpeg']);

    $result = (new RingCentralRecordingSync($ringCentral))->sync();
    $call->refresh();

    expect($result)->checked->toBe(1)->recordings->toBe(1)
        ->and($call->recording_id)->toBe('delayed-recording-1')
        ->and($call->recording_path)->not->toBeNull();
    Storage::disk('local')->assertExists($call->recording_path);
});

test('account call logs missing from the crm are imported once and their recordings are recovered', function () {
    Storage::fake('local');
    config()->set('services.ringcentral.import_call_logs', true);

    $account = Account::query()->create([
        'username' => 'account-import@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $agent = Agent::query()->create(['agent_name' => 'Account Import Agent']);
    $lead = Lead::query()->create([
        'customer_name' => 'Account Import Lead',
        'marital_status' => 'Unknown',
        'primary_number' => '5552223333',
        'address' => '3 Recording Street',
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
    $record = [
        'id' => 'account-call-log-1',
        'direction' => 'Outbound',
        'startTime' => now()->subMinutes(5)->utc()->toIso8601String(),
        'duration' => 75,
        'result' => 'Accepted',
        'to' => ['phoneNumber' => '+15552223333'],
        'recording' => ['id' => 'account-recording-1'],
    ];

    $ringCentral = Mockery::mock(RingCentralService::class);
    $ringCentral->shouldReceive('callLog')->twice()->andReturn([$record]);
    $ringCentral->shouldReceive('normalizePhoneNumber')
        ->andReturnUsing(fn (string $number): string => '+1'.substr(preg_replace('/\D+/', '', $number), -10));
    $ringCentral->shouldReceive('recording')
        ->once()
        ->with('account-recording-1')
        ->andReturn(['body' => 'imported audio bytes', 'content_type' => 'audio/mpeg']);

    $sync = new RingCentralRecordingSync($ringCentral);
    $firstPass = $sync->sync(now()->subDay(), now());

    expect($firstPass)->imported->toBe(1)->recordings->toBe(1)
        ->and(RingCentralCall::query()->where('ringcentral_call_log_id', 'account-call-log-1')->count())->toBe(1);
    $call = RingCentralCall::query()->where('ringcentral_call_log_id', 'account-call-log-1')->firstOrFail();
    expect($call->lead_id)->toBe($lead->id)->and($call->recording_path)->not->toBeNull();
    Storage::disk('local')->assertExists($call->recording_path);

    $secondPass = $sync->sync(now()->subDay(), now());
    expect($secondPass)->imported->toBe(0)
        ->and(RingCentralCall::query()->where('ringcentral_call_log_id', 'account-call-log-1')->count())->toBe(1);
});
