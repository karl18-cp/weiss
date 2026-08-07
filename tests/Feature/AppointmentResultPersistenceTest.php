<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Lead;
use App\Models\LeadNote;
use Inertia\Testing\AssertableInertia as Assert;

test('appointment result note is saved with a move and remains loaded in the destination tab', function () {
    $account = Account::query()->create([
        'username' => 'appointment-result-persistence@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $agent = Agent::query()->create(['agent_name' => 'Appointment Result Agent']);
    $lead = Lead::query()->create([
        'customer_name' => 'Appointment Result Customer',
        'marital_status' => 'Married',
        'primary_number' => '5551234567',
        'address' => '1 Result Street',
        'zip_code' => '90001',
        'city' => 'Los Angeles',
        'county' => 'Los Angeles',
        'state' => 'CA',
        'years_in_house' => 2,
        'house_age' => 1998,
        'needs_financing' => false,
        'house_value' => 500000,
        'appointment_at' => now(),
        'telemarketer_notes' => '',
        'source' => 'Test',
        'agent_id' => $agent->agent_id,
        'created_by' => $account->acc_id,
        'status' => 'dispatched',
    ]);

    $this->actingAs($account)
        ->patch(route('lead-workflow.leads-shop.status.update', $lead), [
            'status' => 'reschedule',
            'appointment_result_note' => 'Customer requested a new appointment date.',
        ])
        ->assertRedirect();

    expect($lead->refresh()->status)->toBe('reschedule');
    $this->assertDatabaseHas('lead_notes', [
        'lead_id' => $lead->id,
        'note_type' => 'appointment_result',
        'body' => 'Customer requested a new appointment date.',
    ]);

    foreach (range(1, 30) as $index) {
        LeadNote::query()->create([
            'lead_id' => $lead->id,
            'note_type' => 'dispatch',
            'body' => "Later activity {$index}",
            'created_by' => $account->acc_id,
        ]);
    }

    $this->get(route('lead-workflow.reschedule', ['lead' => $lead->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('leads.data.0.id', $lead->id)
            ->where(
                'leads.data.0.appointment_result_notes.0.body',
                'Customer requested a new appointment date.',
            )
        );
});
