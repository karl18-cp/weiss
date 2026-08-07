<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Company;
use App\Models\Lead;
use App\Models\Manager;
use App\Models\Product;

function secondManagerFixture(string $status): array
{
    $account = Account::query()->create([
        'username' => "second-manager-{$status}@example.com",
        'password' => 'password',
        'role' => 'manager',
    ]);
    $manager = Manager::query()->create([
        'account_id' => $account->acc_id,
        'manager_name' => "Second Manager {$status}",
        'phone' => '',
        'manager_types' => [],
    ]);
    $manager->permissions()->create([
        'module' => 'leads_shop',
        'access_level' => 'edit',
    ]);
    $company = Company::query()->create([
        'company' => "Second Manager Company {$status}",
        'address' => '',
        'prefix' => 'SM',
        'project_code' => 'SM-001',
    ]);
    $product = Product::query()->create(['product_name' => "Second Manager Product {$status}"]);
    $agent = Agent::query()->create(['agent_name' => "Original Agent {$status}"]);
    $lead = Lead::query()->create([
        'customer_name' => "Second Manager Lead {$status}",
        'marital_status' => 'Married',
        'primary_number' => '+15550000011',
        'address' => '11 Assignment Street',
        'zip_code' => '90001',
        'city' => 'Los Angeles',
        'county' => '',
        'state' => 'CA',
        'years_in_house' => 3,
        'house_age' => 20,
        'needs_financing' => false,
        'house_value' => 700000,
        'crm_qualification_completed_at' => now(),
        'product_id' => $product->prod_id,
        'appointment_at' => now()->addDay(),
        'telemarketer_notes' => '',
        'company_id' => $company->com_id,
        'source' => 'CallTools',
        'agent_id' => $agent->agent_id,
        'created_by' => $account->acc_id,
        'status' => $status,
    ]);

    return compact('account', 'manager', 'lead');
}

test('manager moving a leads shop lead to confirm becomes its second manager', function () {
    ['account' => $account, 'manager' => $manager, 'lead' => $lead] = secondManagerFixture('fresh');

    $this->actingAs($account)
        ->patch(route('lead-workflow.leads-shop.status.update', $lead), ['status' => 'confirmed'])
        ->assertRedirect();

    expect($lead->fresh()->manager_2_id)->toBe($manager->manager_id);
});

test('manager moving a lead from another queue to dispatch fills a missing second manager', function () {
    ['account' => $account, 'manager' => $manager, 'lead' => $lead] = secondManagerFixture('rehash');

    $this->actingAs($account)
        ->patch(route('lead-workflow.leads-shop.status.update', $lead), ['status' => 'dispatched'])
        ->assertRedirect();

    expect($lead->fresh()->manager_2_id)->toBe($manager->manager_id);
});

test('manager moving a lead to keep in touch becomes its second manager', function () {
    ['account' => $account, 'manager' => $manager, 'lead' => $lead] = secondManagerFixture('reschedule');

    $this->actingAs($account)
        ->patch(route('lead-workflow.leads-shop.status.update', $lead), ['status' => 'kit'])
        ->assertRedirect();

    expect($lead->fresh()->manager_2_id)->toBe($manager->manager_id);
});

test('later moves do not overwrite the manager already assigned as second manager', function () {
    ['account' => $account, 'lead' => $lead] = secondManagerFixture('confirmed');
    $originalAccount = Account::query()->create([
        'username' => 'original-second-manager@example.com',
        'password' => 'password',
        'role' => 'manager',
    ]);
    $originalManager = Manager::query()->create([
        'account_id' => $originalAccount->acc_id,
        'manager_name' => 'Original Second Manager',
        'phone' => '',
        'manager_types' => [],
    ]);
    $lead->update(['manager_2_id' => $originalManager->manager_id]);

    $this->actingAs($account)
        ->patch(route('lead-workflow.leads-shop.status.update', $lead), ['status' => 'dispatched'])
        ->assertRedirect();

    expect($lead->fresh()->manager_2_id)->toBe($originalManager->manager_id);
});
