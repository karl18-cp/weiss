<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Company;
use App\Models\Lead;
use App\Models\LeadNote;
use App\Models\Product;
use App\Models\Project;
use App\Models\ProjectAccountingTransaction;
use App\Models\Salesman;
use Inertia\Testing\AssertableInertia as Assert;

function dataAdmin(): Account
{
    return Account::query()->create([
        'username' => 'data-admin@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
}

function dataLead(array $overrides = []): Lead
{
    $company = Company::query()->create([
        'com_id' => 1,
        'company' => 'Test Company',
        'address' => '',
        'prefix' => 'TC',
        'project_code' => 'TC-001',
    ]);
    $product = Product::query()->create(['product_name' => 'Roofing']);
    $agent = Agent::query()->create(['agent_name' => 'Alex Agent']);

    return Lead::query()->create([
        'customer_name' => 'Jordan Customer',
        'marital_status' => 'Single',
        'primary_number' => '555-1111',
        'secondary_number' => null,
        'mobile_number' => '555-2222',
        'address' => '123 Main Street',
        'zip_code' => '90210',
        'city' => 'Los Angeles',
        'county' => 'Los Angeles',
        'state' => 'CA',
        'email' => 'jordan@example.com',
        'years_in_house' => 5,
        'product_id' => $product->prod_id,
        'appointment_at' => now()->addDay(),
        'appointment_result' => null,
        'telemarketer_notes' => 'Original note',
        'company_id' => $company->com_id,
        'source' => 'CallTools',
        'agent_id' => $agent->agent_id,
        'created_by' => 1,
        'status' => 'fresh',
        ...$overrides,
    ]);
}

test('data page shows workflow results and the latest telemarketer note', function () {
    $admin = dataAdmin();
    $salesman = Salesman::query()->create(['salesman_name' => 'Sam Salesman']);
    $lead = dataLead([
        'salesman_1_id' => $salesman->salesman_id,
        'appointment_result' => 'Demoed',
    ]);

    LeadNote::query()->create([
        'lead_id' => $lead->id,
        'note_type' => 'telemarketer',
        'body' => 'Older telemarketer note',
        'created_by' => $admin->acc_id,
        'created_at' => now()->subMinute(),
        'updated_at' => now()->subMinute(),
    ]);
    LeadNote::query()->create([
        'lead_id' => $lead->id,
        'note_type' => 'telemarketer',
        'body' => 'Newest telemarketer note',
        'created_by' => $admin->acc_id,
    ]);

    $this->actingAs($admin)
        ->get(route('lead-workflow.data'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/data')
            ->has('leads.data', 1)
            ->where('leads.data.0.lead_result', 'Salesman Sent')
            ->where('leads.data.0.appointment_result', 'Demoed')
            ->where('leads.data.0.note', 'Newest telemarketer note')
            ->where('leads.data.0.verified', false)
            ->has('agents', 1)
            ->where('agents.0.leads_count', 1),
        );
});

test('only project leads are verified in data', function () {
    $admin = dataAdmin();
    $lead = dataLead(['status' => 'project']);
    Project::query()->create([
        'lead_id' => $lead->id,
        'amount' => 1000,
        'created_by' => $admin->acc_id,
    ]);

    $this->actingAs($admin)
        ->get(route('lead-workflow.data'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('leads.data.0.verified', true)
            ->where('leads.data.0.lead_result', 'Project'),
        );
});

test('data accounting registers aggregate receivables and payables from all projects', function () {
    $admin = dataAdmin();
    $lead = dataLead(['status' => 'project']);
    $project = Project::query()->create([
        'lead_id' => $lead->id,
        'amount' => 5000,
        'created_by' => $admin->acc_id,
    ]);

    ProjectAccountingTransaction::query()->create([
        'project_id' => $project->id,
        'type' => 'receivable',
        'category' => 'Customer Payment',
        'transaction_date' => '2026-07-16',
        'payment_method' => 'check',
        'reference_number' => 'CH#100',
        'counterparty' => 'Jordan Customer',
        'amount' => 1000,
        'status' => 'paid',
        'notes' => 'Customer deposit',
    ]);
    ProjectAccountingTransaction::query()->create([
        'project_id' => $project->id,
        'type' => 'payable',
        'category' => 'Vendor Payment',
        'transaction_date' => '2026-07-17',
        'payment_method' => 'check',
        'reference_number' => 'CH#200',
        'counterparty' => 'Project Vendor',
        'requested_by' => 'Project Manager',
        'amount' => 400,
        'status' => 'ok_to_pay',
        'notes' => 'Vendor draw',
    ]);

    $this->actingAs($admin)
        ->get(route('lead-workflow.data.receivables'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/accounting-register')
            ->where('type', 'receivable')
            ->has('transactions.data', 1)
            ->where('transactions.data.0.project_number', 'TC-00001')
            ->where('transactions.data.0.received_from', 'Jordan Customer')
            ->where('transactions.data.0.reference_number', 'CH#100'));

    $this->actingAs($admin)
        ->get(route('lead-workflow.data.payables'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/accounting-register')
            ->where('type', 'payable')
            ->has('transactions.data', 1)
            ->where('transactions.data.0.company_prefix', 'TC')
            ->where('transactions.data.0.requested_by', 'Project Manager')
            ->where('transactions.data.0.reference_number', 'CH#200'));
});

test('booking board contains only confirmed and dispatched leads', function () {
    $admin = dataAdmin();
    $confirmed = dataLead(['status' => 'confirmed']);
    $dispatched = $confirmed->replicate();
    $dispatched->customer_name = 'Dispatch Customer';
    $dispatched->status = 'dispatched';
    $dispatched->save();
    $excluded = $confirmed->replicate();
    $excluded->customer_name = 'Fresh Customer';
    $excluded->status = 'fresh';
    $excluded->save();

    $this->actingAs($admin)
        ->get(route('lead-workflow.booking-board'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/booking-board')
            ->has('leads', 2)
            ->where('leads.0.status', 'confirmed')
            ->where('leads.1.status', 'dispatched'));
});
