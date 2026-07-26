<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Company;
use App\Models\Lead;
use App\Models\LeadMovement;
use App\Models\Product;
use App\Models\Salesman;
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

test('a requested dispatched booking is loaded and selected in the leads shop', function () {
    $account = Account::query()->create([
        'username' => 'booking-link-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $agent = Agent::query()->create(['agent_name' => 'Booking Link Agent']);
    $lead = Lead::query()->create([
        'customer_name' => 'Requested Booking',
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000003',
        'address' => '3 Test Street',
        'zip_code' => '00000',
        'city' => 'Test City',
        'county' => 'Test County',
        'state' => 'CA',
        'years_in_house' => 0,
        'appointment_at' => now(),
        'telemarketer_notes' => '',
        'source' => 'CallTools',
        'agent_id' => $agent->agent_id,
        'created_by' => $account->acc_id,
        'status' => 'dispatched',
    ]);

    $this->actingAs($account)
        ->get(route('lead-workflow.leads-shop', ['lead' => $lead->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/leads-shop')
            ->has('leads', 1)
            ->where('leads.0.id', $lead->id)
        );
});

test('salesmen cannot open dispatched bookings assigned to someone else', function () {
    $agentAccount = Account::query()->create([
        'username' => 'booking-link-agent',
        'password' => 'password',
        'role' => 'agent',
    ]);
    $agent = Agent::query()->create([
        'account_id' => $agentAccount->acc_id,
        'agent_name' => 'Booking Link Agent',
    ]);
    $salesmanAccount = Account::query()->create([
        'username' => 'booking-link-salesman',
        'password' => 'password',
        'role' => 'salesman',
    ]);
    Salesman::query()->create([
        'account_id' => $salesmanAccount->acc_id,
        'salesman_name' => 'Booking Link Salesman',
    ]);
    $otherSalesman = Salesman::query()->create([
        'salesman_name' => 'Other Booking Salesman',
    ]);
    $lead = Lead::query()->create([
        'customer_name' => 'Other Salesman Booking',
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000004',
        'address' => '4 Test Street',
        'zip_code' => '00000',
        'city' => 'Test City',
        'county' => 'Test County',
        'state' => 'CA',
        'years_in_house' => 0,
        'appointment_at' => now(),
        'telemarketer_notes' => '',
        'source' => 'CallTools',
        'agent_id' => $agent->agent_id,
        'salesman_1_id' => $otherSalesman->salesman_id,
        'created_by' => $agentAccount->acc_id,
        'status' => 'dispatched',
    ]);

    $this->actingAs($salesmanAccount)
        ->get(route('lead-workflow.leads-shop', ['lead' => $lead->id]))
        ->assertForbidden();
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

test('admins can permanently delete sample leads', function () {
    $admin = Account::query()->create([
        'username' => 'sample-delete-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $agent = Agent::query()->create(['agent_name' => 'Sample Delete Agent']);
    $lead = Lead::query()->create([
        'customer_name' => 'Disposable Sample Lead',
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000005',
        'address' => '5 Test Street',
        'zip_code' => '00000',
        'city' => 'Test City',
        'county' => 'Test County',
        'state' => 'CA',
        'years_in_house' => 0,
        'telemarketer_notes' => 'Sample',
        'source' => 'Sample',
        'agent_id' => $agent->agent_id,
        'created_by' => $admin->acc_id,
        'status' => 'fresh',
    ]);

    $this->actingAs($admin)
        ->delete(route('lead-workflow.leads-shop.destroy', $lead))
        ->assertRedirect();

    $this->assertDatabaseMissing('leads', ['id' => $lead->id]);
});

test('non-admin accounts cannot permanently delete leads', function () {
    $account = Account::query()->create([
        'username' => 'sample-delete-agent',
        'password' => 'password',
        'role' => 'agent',
    ]);
    $agent = Agent::query()->create([
        'account_id' => $account->acc_id,
        'agent_name' => 'Restricted Delete Agent',
    ]);
    $agent->permissions()->create([
        'module' => 'leads_shop',
        'access_level' => 'edit',
    ]);
    $lead = Lead::query()->create([
        'customer_name' => 'Protected Lead',
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000006',
        'address' => '6 Test Street',
        'zip_code' => '00000',
        'city' => 'Test City',
        'county' => 'Test County',
        'state' => 'CA',
        'years_in_house' => 0,
        'telemarketer_notes' => '',
        'source' => 'Sample',
        'agent_id' => $agent->agent_id,
        'created_by' => $account->acc_id,
        'status' => 'fresh',
    ]);

    $this->actingAs($account)
        ->from(route('lead-workflow.leads-shop'))
        ->delete(route('lead-workflow.leads-shop.destroy', $lead))
        ->assertForbidden();

    $this->assertDatabaseHas('leads', ['id' => $lead->id]);
});
