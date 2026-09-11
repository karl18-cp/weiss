<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Company;
use App\Models\Lead;
use App\Models\Product;

test('a lead card saves when the optional home fields and email are blank', function () {
    $account = Account::query()->create([
        'username' => 'lead-card-optional-fields@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $company = Company::query()->create([
        'com_id' => 991,
        'company' => 'Optional Fields Company',
        'address' => '1 Main Street',
        'prefix' => 'OFC',
        'project_code' => 'OFC',
    ]);
    $product = Product::query()->create(['product_name' => 'Optional Fields Product']);
    $agent = Agent::query()->create(['agent_name' => 'Optional Fields Agent']);

    $response = $this->actingAs($account)
        ->from(route('lead-workflow.lead-card'))
        ->post(route('lead-workflow.lead-card.store'), [
            'customer_name' => 'Optional Fields Customer',
            'marital_status' => 'Other',
            'primary_number' => '5551234567',
            'secondary_number' => '',
            'mobile_number' => '',
            'address' => '10 Test Street',
            'zip_code' => '95101',
            'city' => 'San Jose',
            'state' => 'CA',
            'email' => '',
            'years_in_house' => '',
            'house_age' => '',
            'needs_financing' => '',
            'house_value' => '',
            'product_id' => $product->prod_id,
            'appointment_at' => now()->addDay()->format('Y-m-d H:i:s'),
            'telemarketer_notes' => 'Created without optional home details.',
            'company_id' => $company->com_id,
            'source' => 'CallTools',
            'agent_id' => $agent->agent_id,
        ]);

    $response->assertRedirect(route('lead-workflow.lead-card'))
        ->assertSessionHasNoErrors();

    $lead = Lead::query()->where('customer_name', 'Optional Fields Customer')->firstOrFail();

    expect($lead->years_in_house)->toBeNull()
        ->and($lead->house_age)->toBeNull()
        ->and($lead->needs_financing)->toBeNull()
        ->and($lead->house_value)->toBeNull()
        ->and($lead->email)->toBeNull();
});
