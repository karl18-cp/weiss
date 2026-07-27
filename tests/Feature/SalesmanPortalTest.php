<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Lead;
use App\Models\LeadNote;
use App\Models\Salesman;
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

    $makeLead('Primary Assignment', $salesman->salesman_id);
    $makeLead('Secondary Assignment', $other->salesman_id, $salesman->salesman_id);
    $makeLead('Hidden Assignment', $other->salesman_id);

    $this->actingAs($salesmanAccount)
        ->get(route('salesman.leads'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('salesman/leads')
            ->has('leads', 2)
            ->where('leads.0.customer_name', 'Secondary Assignment')
            ->where('leads.1.customer_name', 'Primary Assignment')
            ->where('salesman.id', $salesman->salesman_id));
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

test('salesmen can add appointment result notes only to assigned leads', function () {
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

    $this->actingAs($account)
        ->post(route('salesman.leads.appointment-result-notes.store', $notAssigned), [
            'body' => 'This must not be saved.',
        ])
        ->assertForbidden();

    expect(LeadNote::query()->where('lead_id', $notAssigned->id)->exists())->toBeFalse();
});
