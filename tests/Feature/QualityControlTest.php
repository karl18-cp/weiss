<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Company;
use App\Models\Lead;
use App\Models\Product;
use App\Models\Project;
use App\Models\Salesman;
use Inertia\Testing\AssertableInertia as Assert;

function qualityControlFixtures(): array
{
    $account = Account::query()->create([
        'username' => 'quality-control-admin@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $company = Company::query()->create([
        'com_id' => 1,
        'company' => 'Quality Company',
        'address' => '',
        'prefix' => 'QC',
        'project_code' => 'QC-001',
    ]);
    $product = Product::query()->create(['product_name' => 'Quality Product']);
    $agent = Agent::query()->create(['agent_name' => 'Quality Agent']);
    $salesman = Salesman::query()->create(['salesman_name' => 'Quality Salesman']);

    $attributes = [
        'marital_status' => 'Single',
        'primary_number' => '555-3000',
        'address' => '300 Quality Avenue',
        'zip_code' => '90003',
        'city' => 'Los Angeles',
        'county' => 'Los Angeles',
        'state' => 'CA',
        'years_in_house' => 3,
        'product_id' => $product->prod_id,
        'appointment_at' => now()->addDay(),
        'telemarketer_notes' => 'Ready for quality control',
        'company_id' => $company->com_id,
        'source' => 'CallTools',
        'agent_id' => $agent->agent_id,
        'salesman_1_id' => $salesman->salesman_id,
        'created_by' => $account->acc_id,
    ];

    $projectLead = Lead::query()->create($attributes + [
        'customer_name' => 'Project Quality Customer',
        'status' => 'project',
    ]);
    $ordinaryLead = Lead::query()->create($attributes + [
        'customer_name' => 'Ordinary Dispatch Customer',
        'status' => 'dispatched',
    ]);
    Project::query()->create([
        'lead_id' => $projectLead->id,
        'amount' => 15000,
        'created_by' => $account->acc_id,
    ]);

    return compact('account', 'projectLead', 'ordinaryLead');
}

test('quality control contains only leads related to projects', function () {
    ['account' => $account, 'projectLead' => $projectLead, 'ordinaryLead' => $ordinaryLead] = qualityControlFixtures();

    $this->actingAs($account)
        ->get(route('management.quality-control'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('management/quality-control')
            ->has('projects', 1)
            ->where('projects.0.lead.id', $projectLead->id)
            ->where('projects.0.lead.customer_name', 'Project Quality Customer')
            ->missing('projects.1'),
        );

    expect($ordinaryLead->project)->toBeNull();
});

test('a quality control note is saved on the project lead', function () {
    ['account' => $account, 'projectLead' => $projectLead] = qualityControlFixtures();

    $this->actingAs($account)
        ->post(route('lead-workflow.leads-shop.notes.store', $projectLead), [
            'note_type' => 'quality_control',
            'body' => 'Customer details verified.',
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('lead_notes', [
        'lead_id' => $projectLead->id,
        'note_type' => 'quality_control',
        'body' => 'Customer details verified.',
    ]);
});
