<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Lead;
use App\Models\LeadNote;

function duplicateResolutionLead(Account $creator, Agent $agent, array $overrides = []): Lead
{
    return Lead::query()->create([
        'customer_name' => 'Duplicate Customer',
        'marital_status' => 'Unknown',
        'primary_number' => '(555) 123-4567',
        'status' => 'fresh',
        'agent_id' => $agent->agent_id,
        'created_by' => $creator->acc_id,
        'address' => '1 Duplicate Street',
        'city' => 'Los Angeles',
        'state' => 'CA',
        'zip_code' => '90001',
        'county' => '',
        'years_in_house' => 0,
        'telemarketer_notes' => '',
        'source' => 'CallTools',
        ...$overrides,
    ]);
}

test('merging a duplicate keeps the original and transfers new notes and missing data', function () {
    $admin = Account::query()->create(['username' => 'duplicate-merge-admin', 'password' => 'password', 'role' => 'admin']);
    $agent = Agent::query()->create(['agent_name' => 'Duplicate Merge Agent']);
    $original = duplicateResolutionLead($admin, $agent, ['customer_name' => 'Original Customer', 'email' => null]);
    $duplicate = duplicateResolutionLead($admin, $agent, [
        'customer_name' => 'Newest Customer',
        'email' => 'new@example.com',
        'calltools_contact_id' => 'new-contact',
        'duplicate_of_id' => $original->id,
    ]);
    $note = LeadNote::query()->create([
        'lead_id' => $duplicate->id,
        'note_type' => 'telemarketer',
        'body' => 'Newest CallTools note',
        'created_by' => $admin->acc_id,
    ]);

    $this->actingAs($admin)
        ->post(route('lead-workflow.leads-shop.duplicate.merge', $duplicate))
        ->assertRedirect();

    expect(Lead::query()->find($duplicate->id))->toBeNull()
        ->and($original->refresh()->customer_name)->toBe('Original Customer')
        ->and($original->email)->toBe('new@example.com')
        ->and($note->refresh()->lead_id)->toBe($original->id);
});

test('deleting a duplicate removes only the newest lead', function () {
    $admin = Account::query()->create(['username' => 'duplicate-delete-admin', 'password' => 'password', 'role' => 'admin']);
    $agent = Agent::query()->create(['agent_name' => 'Duplicate Delete Agent']);
    $original = duplicateResolutionLead($admin, $agent, ['customer_name' => 'Original Customer']);
    $duplicate = duplicateResolutionLead($admin, $agent, [
        'calltools_contact_id' => 'delete-new-contact',
        'duplicate_of_id' => $original->id,
    ]);

    $this->actingAs($admin)
        ->delete(route('lead-workflow.leads-shop.duplicate.destroy', $duplicate))
        ->assertRedirect();

    expect(Lead::query()->find($duplicate->id))->toBeNull()
        ->and(Lead::query()->find($original->id))->not->toBeNull();
});

test('the original lead cannot be deleted through the duplicate endpoint', function () {
    $admin = Account::query()->create(['username' => 'duplicate-original-admin', 'password' => 'password', 'role' => 'admin']);
    $agent = Agent::query()->create(['agent_name' => 'Duplicate Original Agent']);
    $original = duplicateResolutionLead($admin, $agent);

    $this->actingAs($admin)
        ->delete(route('lead-workflow.leads-shop.duplicate.destroy', $original))
        ->assertStatus(422);

    expect(Lead::query()->find($original->id))->not->toBeNull();
});

