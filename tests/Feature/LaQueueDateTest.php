<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Lead;
use Inertia\Testing\AssertableInertia as Assert;

test('la leads without appointments are grouped by their created date', function () {
    $account = Account::query()->create([
        'username' => 'la-date-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $agent = Agent::query()->create(['agent_name' => 'LA Date Agent']);
    $lead = Lead::query()->create([
        'customer_name' => 'LA Without Appointment',
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000888',
        'address' => '888 LA Street',
        'zip_code' => '90001',
        'city' => 'Los Angeles',
        'county' => '',
        'state' => 'CA',
        'years_in_house' => 0,
        'appointment_at' => null,
        'telemarketer_notes' => '',
        'source' => 'Manual',
        'agent_id' => $agent->agent_id,
        'created_by' => $account->acc_id,
        'status' => 'la',
    ]);
    $lead->timestamps = false;
    $lead->forceFill([
        'created_at' => '2026-08-04 10:00:00',
        'updated_at' => '2026-08-04 10:00:00',
    ])->saveQuietly();

    $this->actingAs($account)
        ->get(route('lead-workflow.la', [
            'date' => '2026-08-04',
            'timezone_offset' => 0,
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/la')
            ->where('selectedDate', '2026-08-04')
            ->where('dateRows.0.key', '2026-08-04')
            ->where('dateRows.0.count', 1)
            ->where('leads.0.id', $lead->id));
});
