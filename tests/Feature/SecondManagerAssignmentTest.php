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
    foreach (['leads_shop', 'confirm_leads', 'dispatch_leads', 'keep_in_touch', 'queue_action_buttons'] as $module) {
        $manager->permissions()->create([
            'module' => $module,
            'access_level' => 'edit',
        ]);
    }
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

test('manager returning a lead to leads shop becomes its second manager', function () {
    ['account' => $account, 'manager' => $manager, 'lead' => $lead] = secondManagerFixture('his');
    $lead->forceFill(['created_at' => now()->subDays(5)])->saveQuietly();

    $this->actingAs($account)
        ->patch(route('lead-workflow.leads-shop.status.update', $lead), ['status' => 'fresh'])
        ->assertRedirect();

    expect($lead->fresh())
        ->status->toBe('fresh')
        ->manager_2_id->toBe($manager->manager_id)
        ->rehash_at->not->toBeNull();

    $this->get(route('lead-workflow.leads-shop', [
        'date_field' => 'created_at',
        'date' => now('America/Los_Angeles')->toDateString(),
    ]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('dateField', 'created_at')
            ->where('leads.0.id', $lead->id));
});

test('manager cannot move a lead to a tab without edit permission', function () {
    ['account' => $account, 'lead' => $lead] = secondManagerFixture('his');

    $account->manager->permissions()->where('module', 'dispatch_leads')->delete();

    $this->actingAs($account)
        ->patch(route('lead-workflow.leads-shop.status.update', $lead), ['status' => 'dispatched'])
        ->assertRedirect();

    expect($lead->fresh()->status)->toBe('his');
});

test('manager without workflow action permission can only return a restricted queue lead to leads shop', function () {
    ['account' => $account, 'manager' => $manager, 'lead' => $lead] = secondManagerFixture('his');

    $manager->permissions()->updateOrCreate(
        ['module' => 'his'],
        ['access_level' => 'edit'],
    );
    $manager->permissions()->where('module', 'leads_shop')->delete();
    $manager->permissions()->updateOrCreate(
        ['module' => 'queue_action_buttons'],
        ['access_level' => 'none'],
    );

    $this->actingAs($account)
        ->from(route('lead-workflow.his'))
        ->patch(route('lead-workflow.leads-shop.status.update', $lead), ['status' => 'dispatched'])
        ->assertRedirect();

    expect($lead->fresh()->status)->toBe('his');

    $this->actingAs($account)
        ->from(route('lead-workflow.his'))
        ->patch(route('lead-workflow.leads-shop.status.update', $lead), ['status' => 'fresh'])
        ->assertRedirect();

    expect($lead->fresh())
        ->status->toBe('fresh')
        ->manager_2_id->toBe($manager->manager_id);
});

test('manager with workflow action permission can use other restricted queue actions', function () {
    ['account' => $account, 'manager' => $manager, 'lead' => $lead] = secondManagerFixture('his');

    $manager->permissions()->updateOrCreate(
        ['module' => 'his'],
        ['access_level' => 'edit'],
    );
    $manager->permissions()->updateOrCreate(
        ['module' => 'queue_action_buttons'],
        ['access_level' => 'edit'],
    );

    $this->actingAs($account)
        ->from(route('lead-workflow.his'))
        ->patch(route('lead-workflow.leads-shop.status.update', $lead), ['status' => 'dispatched'])
        ->assertRedirect();

    expect($lead->fresh()->status)->toBe('dispatched');
});
