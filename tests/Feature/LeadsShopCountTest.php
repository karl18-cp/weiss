<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Company;
use App\Models\Lead;
use App\Models\LeadMovement;
use App\Models\Product;
use Inertia\Testing\AssertableInertia as Assert;

test('leads shop only loads and counts leads that remain in its statuses', function () {
    $account = Account::query()->create([
        'username' => 'shop-count-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $company = Company::query()->create([
        'com_id' => 801,
        'company' => 'Shop Count Company',
        'address' => '',
        'prefix' => 'SC',
        'project_code' => 'SC-001',
    ]);
    $product = Product::query()->create(['product_name' => 'Shop Count Product']);
    $agent = Agent::query()->create(['agent_name' => 'Shop Count Agent']);

    $makeLead = function (string $status, string $name) use ($account, $company, $product, $agent): Lead {
        return Lead::query()->create([
            'customer_name' => $name,
            'marital_status' => 'Unknown',
            'primary_number' => '+15550000000',
            'address' => '1 Test Street',
            'zip_code' => '00000',
            'city' => 'Test City',
            'county' => 'Test County',
            'state' => 'CA',
            'years_in_house' => 0,
            'product_id' => $product->prod_id,
            'appointment_at' => now(),
            'telemarketer_notes' => 'Test note',
            'company_id' => $company->com_id,
            'source' => 'CallTools',
            'agent_id' => $agent->agent_id,
            'created_by' => $account->acc_id,
            'status' => $status,
        ]);
    };

    $makeLead('fresh', 'Fresh Shop Lead');
    $makeLead('raw', 'Raw Shop Lead');
    $makeLead('confirmed', 'Moved To Confirmation');
    $makeLead('dispatched', 'Moved To Dispatch');
    $makeLead('project', 'Converted Project');

    $this->actingAs($account)
        ->get(route('lead-workflow.leads-shop'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/leads-shop')
            ->has('leads', 2)
            ->where('leads.0.customer_name', fn (string $name): bool => in_array($name, ['Fresh Shop Lead', 'Raw Shop Lead'], true))
            ->where('leads.1.customer_name', fn (string $name): bool => in_array($name, ['Fresh Shop Lead', 'Raw Shop Lead'], true))
        );
});

test('lead status changes record where it moved and who moved it', function () {
    $creator = Account::query()->create([
        'username' => 'movement-creator',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $mover = Account::query()->create([
        'username' => 'movement-user',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $company = Company::query()->create([
        'com_id' => 802,
        'company' => 'Movement Company',
        'address' => '',
        'prefix' => 'MV',
        'project_code' => 'MV-001',
    ]);
    $product = Product::query()->create(['product_name' => 'Movement Product']);
    $agent = Agent::query()->create(['agent_name' => 'Movement Agent']);
    $lead = Lead::query()->create([
        'customer_name' => 'Moving Lead',
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000001',
        'address' => '2 Test Street',
        'zip_code' => '00000',
        'city' => 'Test City',
        'county' => 'Test County',
        'state' => 'CA',
        'years_in_house' => 0,
        'product_id' => $product->prod_id,
        'appointment_at' => now(),
        'telemarketer_notes' => '',
        'company_id' => $company->com_id,
        'source' => 'CallTools',
        'agent_id' => $agent->agent_id,
        'created_by' => $creator->acc_id,
        'status' => 'fresh',
    ]);

    $this->actingAs($mover)
        ->patch(route('lead-workflow.leads-shop.status.update', $lead), [
            'status' => 'confirmed',
        ])
        ->assertRedirect();

    $movement = LeadMovement::query()->latest('id')->firstOrFail();

    expect($movement->lead_id)->toBe($lead->id)
        ->and($movement->from_status)->toBe('fresh')
        ->and($movement->to_status)->toBe('confirmed')
        ->and($movement->moved_by)->toBe($mover->acc_id);
});
