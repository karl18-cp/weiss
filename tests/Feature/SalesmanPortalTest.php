<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Lead;
use App\Models\LeadNote;
use App\Models\PushSubscription;
use App\Models\Project;
use App\Models\Salesman;
use App\Services\GoogleDriveProjectStorage;
use App\Services\WebPushService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

test('the salesman leads page only returns assigned leads', function () {
    $agentAccount = Account::query()->create([
        'username' => 'portal-agent@example.com',
        'password' => 'password',
        'role' => 'agent',
    ]);
    $agent = Agent::query()->create([
        'agent_name' => 'Portal Agent',
        'account_id' => $agentAccount->acc_id,
    ]);
    $salesmanAccount = Account::query()->create([
        'username' => 'my-leads-salesman@example.com',
        'password' => 'password',
        'role' => 'salesman',
    ]);
    $salesman = Salesman::query()->create([
        'salesman_name' => 'My Leads Salesman',
        'account_id' => $salesmanAccount->acc_id,
    ]);
    $other = Salesman::query()->create(['salesman_name' => 'Other Salesman']);

    $makeLead = function (string $name, ?int $first, ?int $second = null) use ($agent): Lead {
        return Lead::query()->create([
            'customer_name' => $name,
            'marital_status' => 'Single',
            'primary_number' => '555-0100',
            'address' => '100 Main Street',
            'zip_code' => '90001',
            'city' => 'Los Angeles',
            'county' => 'Los Angeles',
            'state' => 'CA',
            'years_in_house' => 5,
            'appointment_at' => now()->addDay(),
            'telemarketer_notes' => 'Portal test',
            'source' => 'Test',
            'agent_id' => $agent->agent_id,
            'salesman_1_id' => $first,
            'salesman_2_id' => $second,
            'created_by' => $agent->account_id,
            'status' => 'dispatched',
        ]);
    };

    $primary = $makeLead('Primary Assignment', $salesman->salesman_id);
    $makeLead('Secondary Assignment', $other->salesman_id, $salesman->salesman_id);
    $hidden = $makeLead('Hidden Assignment', $other->salesman_id);

    LeadNote::query()->create([
        'lead_id' => $primary->id,
        'note_type' => 'dispatch',
        'body' => 'Gate code is 2468. Customer prefers the side entrance.',
        'created_by' => $agentAccount->acc_id,
    ]);

    $this->actingAs($salesmanAccount)
        ->get(route('salesman.leads'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('salesman/leads')
            ->has('leads', 2)
            ->where('leads', fn ($leads) => collect($leads)
                ->pluck('customer_name')
                ->sort()
                ->values()
                ->all() === ['Primary Assignment', 'Secondary Assignment'])
            ->where('salesman.id', $salesman->salesman_id));

    $this->actingAs($salesmanAccount)
        ->get(route('salesman.lead-information', ['lead' => $primary->id]))
        ->assertInertia(fn (Assert $page) => $page
            ->component('salesman/lead-information')
            ->where('lead.id', $primary->id)
            ->where('dispatchNote', 'Gate code is 2468. Customer prefers the side entrance.'));

    $this->actingAs($salesmanAccount)
        ->get(route('salesman.lead-information', ['lead' => $hidden->id]))
        ->assertNotFound();
});

test('non-salesman accounts cannot open the salesman portal', function () {
    $admin = Account::query()->create([
        'username' => 'portal-admin@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);

    $this->actingAs($admin)
        ->get(route('salesman.leads'))
        ->assertForbidden();
});

test('salesman my sold only returns assigned leads that have projects', function () {
    $account = Account::query()->create(['username' => 'sold-salesman@example.com', 'password' => 'password', 'role' => 'salesman']);
    $salesman = Salesman::query()->create(['salesman_name' => 'Sold Salesman', 'account_id' => $account->acc_id]);
    $other = Salesman::query()->create(['salesman_name' => 'Other Sold Salesman']);
    $leadData = [
        'marital_status' => 'Single', 'primary_number' => '555-0101', 'address' => '1 Sold Street',
        'zip_code' => '90001', 'city' => 'Los Angeles', 'county' => 'Los Angeles', 'state' => 'CA',
        'years_in_house' => 1, 'appointment_at' => now(), 'source' => 'Test', 'created_by' => $account->acc_id,
    ];
    $sold = Lead::query()->create([...$leadData, 'customer_name' => 'My Sold Lead', 'salesman_1_id' => $salesman->salesman_id, 'status' => 'project']);
    $unsold = Lead::query()->create([...$leadData, 'customer_name' => 'Not Sold Yet', 'salesman_1_id' => $salesman->salesman_id, 'status' => 'dispatched']);
    $otherSold = Lead::query()->create([...$leadData, 'customer_name' => 'Someone Else Sold', 'salesman_1_id' => $other->salesman_id, 'status' => 'project']);
    Project::query()->create(['lead_id' => $sold->id, 'project_number' => 'SBH#6001', 'amount' => 15000, 'status' => 'new', 'created_by' => $account->acc_id]);
    Project::query()->create(['lead_id' => $otherSold->id, 'project_number' => 'SBH#6002', 'amount' => 9000, 'status' => 'new', 'created_by' => $account->acc_id]);

    $this->actingAs($account)->get(route('salesman.sold'))->assertInertia(fn (Assert $page) => $page
        ->component('salesman/leads')->where('mode', 'sold')->has('leads', 1)
        ->where('leads.0.id', $sold->id)->where('leads.0.project.project_number', 'SBH#6001'));
});

test('salesman accounts can keep their portal session alive', function () {
    $account = Account::query()->create([
        'username' => 'keep-alive-salesman@example.com',
        'password' => 'password',
        'role' => 'salesman',
    ]);
    Salesman::query()->create([
        'salesman_name' => 'Keep Alive Salesman',
        'account_id' => $account->acc_id,
    ]);

    $this->actingAs($account)
        ->get(route('salesman.session.keep-alive'))
        ->assertOk()
        ->assertJson(['active' => true])
        ->assertSessionHas('salesman_last_keep_alive_at');
});

test('salesman follow ups and crm keep in touch use the same lead status', function () {
    $account = Account::query()->create([
        'username' => 'follow-up-salesman@example.com',
        'password' => 'password',
        'role' => 'salesman',
    ]);
    $salesman = Salesman::query()->create([
        'salesman_name' => 'Follow Up Salesman',
        'account_id' => $account->acc_id,
    ]);
    $lead = Lead::query()->create([
        'customer_name' => 'Portal Follow Up',
        'marital_status' => 'Single',
        'primary_number' => '555-0199',
        'address' => '10 Follow Up Street',
        'zip_code' => '90001',
        'city' => 'Los Angeles',
        'county' => 'Los Angeles',
        'state' => 'CA',
        'years_in_house' => 2,
        'appointment_at' => now()->addDay(),
        'source' => 'Test',
        'salesman_1_id' => $salesman->salesman_id,
        'created_by' => $account->acc_id,
        'status' => 'dispatched',
    ]);

    $push = Mockery::mock(WebPushService::class);
    $push->shouldReceive('sendToAccount')->zeroOrMoreTimes()->andReturn(1);
    app()->instance(WebPushService::class, $push);

    $this->actingAs($account)
        ->post(route('salesman.leads.appointment-result-notes.store', $lead), [
            'action' => 'follow_up',
        ])
        ->assertRedirect(route('salesman.follow-ups'));

    expect($lead->refresh()->status)->toBe('kit');

    $this->actingAs($account)
        ->get(route('salesman.follow-ups'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('salesman/leads')
            ->where('mode', 'follow-ups')
            ->has('leads', 1)
            ->where('leads.0.id', $lead->id));

    $lead->update(['status' => 'dispatched']);
    $this->actingAs($account)
        ->get(route('salesman.follow-ups'))
        ->assertInertia(fn (Assert $page) => $page->has('leads', 0));

    $lead->update(['status' => 'kit']);
    $this->actingAs($account)
        ->get(route('salesman.follow-ups'))
        ->assertInertia(fn (Assert $page) => $page->has('leads', 1));
});

test('salesmen can add appointment result notes only to assigned leads', function () {
    Storage::fake('local');
    $agentAccount = Account::query()->create([
        'username' => 'result-note-agent@example.com',
        'password' => 'password',
        'role' => 'agent',
    ]);
    $agent = Agent::query()->create([
        'agent_name' => 'Result Note Agent',
        'account_id' => $agentAccount->acc_id,
    ]);
    $account = Account::query()->create([
        'username' => 'result-note-salesman@example.com',
        'password' => 'password',
        'role' => 'salesman',
    ]);
    $salesman = Salesman::query()->create([
        'salesman_name' => 'Result Note Salesman',
        'account_id' => $account->acc_id,
    ]);
    $other = Salesman::query()->create(['salesman_name' => 'Other Salesman']);

    $makeLead = fn (string $name, int $salesmanId): Lead => Lead::query()->create([
        'customer_name' => $name,
        'marital_status' => 'Single',
        'primary_number' => '555-0100',
        'address' => '100 Main Street',
        'zip_code' => '90001',
        'city' => 'Los Angeles',
        'county' => 'Los Angeles',
        'state' => 'CA',
        'years_in_house' => 5,
        'appointment_at' => now()->addDay(),
        'telemarketer_notes' => 'Portal test',
        'source' => 'Test',
        'agent_id' => $agent->agent_id,
        'salesman_1_id' => $salesmanId,
        'created_by' => $account->acc_id,
        'status' => 'dispatched',
    ]);

    $assigned = $makeLead('Assigned Result Lead', $salesman->salesman_id);
    $notAssigned = $makeLead('Other Result Lead', $other->salesman_id);

    $this->actingAs($account)
        ->post(route('salesman.leads.appointment-result-notes.store', $assigned), [
            'body' => 'Customer requested a follow-up estimate.',
        ])
        ->assertRedirect();

    expect(LeadNote::query()
        ->where('lead_id', $assigned->id)
        ->where('note_type', 'appointment_result')
        ->where('body', 'Customer requested a follow-up estimate.')
        ->exists())->toBeTrue();

    $admin = Account::query()->create([
        'username' => 'status-admin@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $manager = Account::query()->create([
        'username' => 'status-manager@example.com',
        'password' => 'password',
        'role' => 'manager',
    ]);
    $push = Mockery::mock(WebPushService::class);
    $push->shouldReceive('sendToAccount')
        ->once()
        ->with($admin->acc_id, 'Result Note Salesman: On My Way', Mockery::type('string'), "/lead-workflow/dispatch-leads?lead={$assigned->id}")
        ->andReturn(1);
    $push->shouldReceive('sendToAccount')
        ->once()
        ->with($manager->acc_id, 'Result Note Salesman: On My Way', Mockery::type('string'), "/lead-workflow/dispatch-leads?lead={$assigned->id}")
        ->andReturn(1);
    app()->instance(WebPushService::class, $push);

    $this->actingAs($account)
        ->post(route('salesman.leads.appointment-result-notes.store', $assigned), [
            'action' => 'on_my_way',
        ])
        ->assertRedirect();

    expect(LeadNote::query()
        ->where('lead_id', $assigned->id)
        ->where('note_type', 'appointment_result')
        ->where('body', 'Salesman update: On My Way')
        ->exists())->toBeTrue();

    expect(LeadNote::query()
        ->where('lead_id', $assigned->id)
        ->where('note_type', 'dispatch')
        ->where('body', 'Salesman update: On My Way')
        ->exists())->toBeTrue();

    $this->actingAs($account)
        ->post(route('salesman.leads.appointment-result-notes.store', $assigned), [
            'action' => 'sold',
        ])
        ->assertSessionHasErrors('sale_amount');

    $push = Mockery::mock(WebPushService::class);
    $push->shouldReceive('sendToAccount')->twice()->andReturn(1);
    app()->instance(WebPushService::class, $push);

    $this->actingAs($account)
        ->post(route('salesman.leads.appointment-result-notes.store', $assigned), [
            'action' => 'sold',
            'sale_amount' => 12500,
        ])
        ->assertSessionHasErrors('contract_file');

    $drive = Mockery::mock(GoogleDriveProjectStorage::class);
    $drive->shouldReceive('configured')->once()->andReturnTrue();
    $drive->shouldReceive('mirror')
        ->once()
        ->withArgs(fn ($project, $path, $name, $mime) =>
            $project instanceof \App\Models\Project
            && $project->lead_id === $assigned->id
            && is_string($path)
            && $name === 'signed-contract.jpg'
            && str_starts_with((string) $mime, 'image/')
        )
        ->andReturn(['id' => 'drive-contract-id', 'name' => 'signed-contract.jpg']);
    app()->instance(GoogleDriveProjectStorage::class, $drive);

    $this->actingAs($account)
        ->post(route('salesman.leads.appointment-result-notes.store', $assigned), [
            'action' => 'sold',
            'sale_amount' => 12500,
            'contract_file' => UploadedFile::fake()->image('signed-contract.jpg'),
        ])
        ->assertRedirect();

    expect($assigned->refresh()->status)->toBe('project');
    expect($assigned->project)->not->toBeNull();
    expect($assigned->project->amount)->toBe('12500.00');
    Storage::disk('local')->assertExists($assigned->project->contract_file_path);

    foreach (['appointment_result', 'dispatch'] as $noteType) {
        expect(LeadNote::query()
            ->where('lead_id', $assigned->id)
            ->where('note_type', $noteType)
            ->where('body', 'Salesman update: Sold — Sale amount: $12,500.00')
            ->exists())->toBeTrue();
    }

    $this->actingAs($account)
        ->post(route('salesman.leads.appointment-result-notes.store', $notAssigned), [
            'body' => 'This must not be saved.',
        ])
        ->assertForbidden();

    expect(LeadNote::query()->where('lead_id', $notAssigned->id)->exists())->toBeFalse();
});

test('salesmen can register and remove a phone push subscription', function () {
    $account = Account::query()->create([
        'username' => 'push-salesman@example.com',
        'password' => 'password',
        'role' => 'salesman',
    ]);
    Salesman::query()->create([
        'salesman_name' => 'Push Salesman',
        'account_id' => $account->acc_id,
    ]);
    $endpoint = 'https://push.example.test/device/123';

    $this->actingAs($account)
        ->postJson(route('salesman.push-subscriptions.store'), [
            'endpoint' => $endpoint,
            'keys' => ['p256dh' => 'public-key', 'auth' => 'auth-token'],
        ])
        ->assertOk()
        ->assertJson(['subscribed' => true]);

    expect(PushSubscription::query()
        ->where('account_id', $account->acc_id)
        ->where('endpoint', $endpoint)
        ->exists())->toBeTrue();

    $this->actingAs($account)
        ->deleteJson(route('salesman.push-subscriptions.destroy'), ['endpoint' => $endpoint])
        ->assertNoContent();

    expect(PushSubscription::query()->where('endpoint', $endpoint)->exists())->toBeFalse();
});

test('an existing phone subscription is reassigned to the logged in manager', function () {
    $salesmanAccount = Account::query()->create([
        'username' => 'previous-phone-owner@example.com',
        'password' => 'password',
        'role' => 'salesman',
    ]);
    $managerAccount = Account::query()->create([
        'username' => 'phone-manager@example.com',
        'password' => 'password',
        'role' => 'manager',
    ]);
    $endpoint = 'https://push.example.test/device/shared-phone';
    PushSubscription::query()->create([
        'account_id' => $salesmanAccount->acc_id,
        'endpoint' => $endpoint,
        'public_key' => 'old-public-key',
        'auth_token' => 'old-auth-token',
        'content_encoding' => 'aes128gcm',
    ]);

    $this->actingAs($managerAccount)
        ->postJson(route('salesman.push-subscriptions.store'), [
            'endpoint' => $endpoint,
            'keys' => ['p256dh' => 'manager-public-key', 'auth' => 'manager-auth-token'],
        ])
        ->assertOk()
        ->assertJson(['subscribed' => true]);

    expect(PushSubscription::query()->where('endpoint', $endpoint)->value('account_id'))
        ->toBe($managerAccount->acc_id);
});
