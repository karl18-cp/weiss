<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Lead;

function dispatchedFollowUpLead(Account $creator): Lead
{
    $agent = Agent::query()->create([
        'agent_name' => 'Dispatch Follow Up Agent '.uniqid(),
    ]);

    return Lead::query()->create([
        'customer_name' => 'Dispatch Follow Up Customer',
        'marital_status' => 'Unknown',
        'primary_number' => '+15551234567',
        'status' => 'dispatched',
        'agent_id' => $agent->agent_id,
        'created_by' => $creator->acc_id,
        'address' => '1 Follow Up Street',
        'city' => 'Los Angeles',
        'state' => 'CA',
        'zip_code' => '90001',
        'county' => '',
        'years_in_house' => 0,
        'telemarketer_notes' => '',
        'source' => 'Manual',
    ]);
}

test('dispatch requires a follow-up time before moving to follow-up queues', function (string $destination) {
    $admin = Account::query()->create([
        'username' => 'dispatch-follow-up-required-'.$destination,
        'password' => 'password',
        'role' => 'admin',
    ]);
    $lead = dispatchedFollowUpLead($admin);

    $this->actingAs($admin)
        ->from('/lead-workflow/dispatch')
        ->patch(route('lead-workflow.leads-shop.status.update', $lead), [
            'status' => $destination,
        ])
        ->assertSessionHasErrors('follow_up_at');

    expect($lead->refresh()->status)->toBe('dispatched');
})->with(['kit', 'rehash', 'reschedule']);

test('dispatch stores the follow-up time when moving to a follow-up queue', function (string $destination) {
    $admin = Account::query()->create([
        'username' => 'dispatch-follow-up-saved-'.$destination,
        'password' => 'password',
        'role' => 'admin',
    ]);
    $lead = dispatchedFollowUpLead($admin);
    $followUpAt = now()->addDays(2)->startOfMinute();

    $this->actingAs($admin)
        ->from('/lead-workflow/dispatch')
        ->patch(route('lead-workflow.leads-shop.status.update', $lead), [
            'status' => $destination,
            'follow_up_at' => $followUpAt->format('Y-m-d H:i:s'),
        ])
        ->assertRedirect('/lead-workflow/dispatch');

    $lead->refresh();

    expect($lead->status)->toBe($destination)
        ->and($lead->appointment_at?->format('Y-m-d H:i:s'))
        ->toBe($followUpAt->format('Y-m-d H:i:s'));
})->with(['kit', 'rehash', 'reschedule']);

