<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Company;
use App\Models\Lead;
use App\Models\Product;
use App\Models\Project;
use App\Models\Salesman;

test('commission transactions only accept salesmen assigned to the project', function () {
    $admin = Account::query()->create([
        'username' => 'commission-assignment-admin@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $assignedSalesman = Salesman::query()->create([
        'salesman_name' => 'Assigned Salesman',
        'sale_commission_percent' => 50,
    ]);
    $unrelatedSalesman = Salesman::query()->create(['salesman_name' => 'Unrelated Salesman']);
    $project = Project::query()->create([
        'project_number' => 'SBH#COMM-ASSIGN',
        'customer_name' => 'Commission Customer',
        'salesman_id' => $assignedSalesman->salesman_id,
        'amount' => 10000,
        'status' => 'completed',
        'created_by' => $admin->acc_id,
    ]);
    $project->sales()->create(['type' => 'original', 'amount' => 10000, 'sale_date' => '2026-08-28']);
    $project->accountingTransactions()->create([
        'type' => 'receivable', 'category' => 'Customer Payment',
        'transaction_date' => '2026-08-28', 'amount' => 10000, 'status' => 'deposit',
    ]);
    $payload = [
        'type' => 'payable',
        'category' => 'Commission (default)',
        'transaction_date' => '2026-08-28',
        'amount' => 500,
        'status' => 'pending',
    ];

    $this->actingAs($admin)
        ->post(route('management.projects.accounting-transactions.store', $project), $payload)
        ->assertSessionHasErrors('salesman_id');

    $this->post(route('management.projects.accounting-transactions.store', $project), [
        ...$payload,
        'salesman_id' => $unrelatedSalesman->salesman_id,
    ])->assertSessionHasErrors('salesman_id');

    $this->post(route('management.projects.accounting-transactions.store', $project), [
        ...$payload,
        'salesman_id' => $assignedSalesman->salesman_id,
        'amount' => 5000.01,
    ])->assertSessionHasErrors('amount');

    $this->post(route('management.projects.accounting-transactions.store', $project), [
        ...$payload,
        'salesman_id' => $assignedSalesman->salesman_id,
    ])->assertRedirect()->assertSessionHasNoErrors();

    $this->assertDatabaseHas('project_accounting_transactions', [
        'project_id' => $project->id,
        'salesman_id' => $assignedSalesman->salesman_id,
        'category' => 'Commission (default)',
        'counterparty' => 'Assigned Salesman',
    ]);

    $commission = $project->accountingTransactions()->firstOrFail();
    $this->post(route('management.projects.accounting-transactions.update', [$project, $commission]), [
        ...$payload,
        'salesman_id' => $assignedSalesman->salesman_id,
        'amount' => 625,
        'notes' => 'Adjusted commission payment',
    ])->assertRedirect()->assertSessionHasNoErrors();

    expect($commission->refresh())
        ->amount->toBe('625.00')
        ->counterparty->toBe('Assigned Salesman')
        ->notes->toBe('Adjusted commission payment');

    $this->delete(route('management.projects.accounting-transactions.destroy', [$project, $commission]))
        ->assertRedirect();

    $this->assertDatabaseMissing('project_accounting_transactions', ['id' => $commission->id]);
});

test('completed project commission uses expenses and lead cost to calculate the commission base', function () {
    $admin = Account::query()->create([
        'username' => 'commission-admin@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $salesman = Salesman::query()->create([
        'salesman_name' => 'Elad T.',
        'initial_sale_cut_percent' => 20,
        'change_order_cut_percent' => 20,
        'sale_commission_percent' => 50,
    ]);
    $project = Project::query()->create([
        'project_number' => 'SBH#5157',
        'customer_name' => 'April Weeks',
        'salesman_id' => $salesman->salesman_id,
        'amount' => 28500,
        'status' => 'completed',
        'created_by' => $admin->acc_id,
    ]);
    $project->sales()->create([
        'type' => 'original',
        'amount' => 28500,
        'sale_date' => '2026-08-27',
    ]);
    $project->accountingTransactions()->create([
        'type' => 'payable',
        'category' => 'Payable (default)',
        'transaction_date' => '2026-08-27',
        'amount' => 11641.15,
        'status' => 'paid',
    ]);
    $project->accountingTransactions()->create([
        'type' => 'receivable', 'category' => 'Customer Payment',
        'transaction_date' => '2026-08-27', 'amount' => 28500, 'status' => 'deposit',
    ]);
    Project::query()->whereKey($project->id)->update(['status' => 'completed']);

    $this->actingAs($admin)
        ->getJson(route('management.salesmen.report', $salesman))
        ->assertOk()
        ->assertJsonPath('commission.rows.0.total_sale', 28500)
        ->assertJsonPath('commission.rows.0.expenses', 11641.15)
        ->assertJsonPath('commission.rows.0.initial_cut', 5700)
        ->assertJsonPath('commission.rows.0.commission_base', 11158.85)
        ->assertJsonPath('commission.rows.0.commission_due', 5579.42)
        ->assertJsonPath('commission.rows.0.commission_balance', 5579.42)
        ->assertJsonPath('commission.summary.commission_due', 5579.42);

    Project::query()->whereKey($project->id)->update(['status' => 'completed']);

    $this->actingAs($admin)
        ->getJson(route('management.projects.commission-breakdown', $project))
        ->assertOk()
        ->assertJsonPath('salesmen.0.salesman_name', 'Elad T.')
        ->assertJsonPath('salesmen.0.lead_cost_rate', 20)
        ->assertJsonPath('salesmen.0.lead_cost', 5700)
        ->assertJsonPath('salesmen.0.commission_base', 11158.85)
        ->assertJsonPath('salesmen.0.commission_rate', 50)
        ->assertJsonPath('salesmen.0.commission_due', 5579.42)
        ->assertJsonPath('accounting.total_commission', 5579.42)
        ->assertJsonPath('accounting.received_commissionable', 28500)
        ->assertJsonPath('accounting.project_balance', 0);
});

test('lead cost is calculated from total receivables instead of the original sale', function () {
    $admin = Account::query()->create([
        'username' => 'receivable-lead-cost-admin@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $salesman = Salesman::query()->create([
        'salesman_name' => 'Receivable Salesman',
        'initial_sale_cut_percent' => 20,
        'sale_commission_percent' => 50,
    ]);
    $project = Project::query()->create([
        'project_number' => 'SBH#RECEIVABLE-CUT',
        'customer_name' => 'Receivable Customer',
        'salesman_id' => $salesman->salesman_id,
        'amount' => 10000,
        'status' => 'completed',
        'created_by' => $admin->acc_id,
    ]);
    $project->sales()->create([
        'type' => 'original',
        'amount' => 10000,
        'sale_date' => '2026-09-09',
    ]);
    $project->accountingTransactions()->createMany([
        ['type' => 'receivable', 'category' => 'Customer Payment', 'transaction_date' => '2026-09-09', 'amount' => 8000, 'status' => 'deposit'],
        ['type' => 'payable', 'category' => 'Payable (default)', 'transaction_date' => '2026-09-09', 'amount' => 3000, 'status' => 'pending'],
    ]);

    $this->actingAs($admin)
        ->getJson(route('management.projects.commission-breakdown', $project))
        ->assertOk()
        ->assertJsonPath('salesmen.0.lead_cost', 1600)
        ->assertJsonPath('salesmen.0.expenses', 3000)
        ->assertJsonPath('salesmen.0.commission_base', 3400)
        ->assertJsonPath('salesmen.0.commission_due', 1700)
        ->assertJsonPath('accounting.total_commission', 1700)
        ->assertJsonPath('accounting.profit_net', 1700);
});

test('commission payments do not reduce the commission base a second time', function () {
    $admin = Account::query()->create([
        'username' => 'commission-payment-admin@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $salesman = Salesman::query()->create([
        'salesman_name' => 'Paid Salesman',
        'initial_sale_cut_percent' => 20,
        'change_order_cut_percent' => 20,
        'sale_commission_percent' => 50,
    ]);
    $project = Project::query()->create([
        'project_number' => 'SBH#5158',
        'customer_name' => 'Paid Customer',
        'salesman_id' => $salesman->salesman_id,
        'amount' => 28500,
        'status' => 'completed',
        'created_by' => $admin->acc_id,
    ]);
    $project->sales()->create([
        'type' => 'original',
        'amount' => 28500,
        'sale_date' => '2026-08-27',
    ]);
    $project->accountingTransactions()->createMany([
        [
            'type' => 'receivable',
            'category' => 'Customer Payment',
            'transaction_date' => '2026-08-27',
            'amount' => 28500,
            'status' => 'deposit',
        ],
        [
            'type' => 'payable',
            'category' => 'Payable (default)',
            'transaction_date' => '2026-08-27',
            'amount' => 11641.15,
            'status' => 'paid',
        ],
        [
            'type' => 'payable',
            'category' => 'Commission (default)',
            'transaction_date' => '2026-08-27',
            'salesman_id' => $salesman->salesman_id,
            'amount' => 5579.42,
            'status' => 'paid',
        ],
    ]);
    Project::query()->whereKey($project->id)->update(['status' => 'completed']);

    $this->actingAs($admin)
        ->getJson(route('management.salesmen.report', $salesman))
        ->assertOk()
        ->assertJsonPath('commission.rows.0.expenses', 11641.15)
        ->assertJsonPath('commission.rows.0.commission_due', 5579.42)
        ->assertJsonPath('commission.rows.0.commission_paid', 5579.42)
        ->assertJsonPath('commission.rows.0.commission_balance', 0);
});

test('both project overview salesmen earn from the original sale while referral-only salesmen do not', function () {
    $admin = Account::query()->create([
        'username' => 'overview-commission-admin@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $company = Company::query()->create([
        'com_id' => 1,
        'company' => 'Overview Commission Company',
        'address' => '',
        'prefix' => 'OVR',
        'project_code' => 'OVR#100',
    ]);
    $product = Product::query()->create(['product_name' => 'Overview Commission Product']);
    $agent = Agent::query()->create(['agent_name' => 'Overview Commission Agent']);
    $primarySalesman = Salesman::query()->create([
        'salesman_name' => 'Overview Salesman One',
        'initial_sale_cut_percent' => 20,
        'change_order_cut_percent' => 20,
        'sale_commission_percent' => 50,
        'shared_sale_commission_percent' => 25,
    ]);
    $secondarySalesman = Salesman::query()->create([
        'salesman_name' => 'Overview Salesman Two',
        'initial_sale_cut_percent' => 20,
        'change_order_cut_percent' => 20,
        'sale_commission_percent' => 50,
        'shared_sale_commission_percent' => 25,
    ]);
    $referralOnlySalesman = Salesman::query()->create([
        'salesman_name' => 'Referral Only Salesman',
        'shared_sale_commission_percent' => 30,
    ]);
    $lead = Lead::query()->create([
        'customer_name' => 'Overview Commission Customer',
        'marital_status' => 'Single',
        'primary_number' => '555-3000',
        'mobile_number' => '555-3001',
        'address' => '100 Commission Way',
        'zip_code' => '94587',
        'city' => 'Union City',
        'county' => 'Alameda',
        'state' => 'CA',
        'years_in_house' => 4,
        'product_id' => $product->prod_id,
        'appointment_at' => now()->addDay(),
        'telemarketer_notes' => 'Commission eligibility test',
        'company_id' => $company->com_id,
        'source' => 'Test',
        'agent_id' => $agent->agent_id,
        'created_by' => $admin->acc_id,
        'status' => 'dispatched',
        'salesman_1_id' => $primarySalesman->salesman_id,
        'salesman_2_id' => $secondarySalesman->salesman_id,
    ]);
    $project = Project::query()->create([
        'lead_id' => $lead->id,
        'project_number' => 'OVR#100',
        'amount' => 10000,
        'status' => 'completed',
        'created_by' => $admin->acc_id,
    ]);
    $project->sales()->createMany([
        ['type' => 'original', 'amount' => 10000, 'sale_date' => '2026-08-31'],
        ['type' => 'referral', 'amount' => 2000, 'sale_date' => '2026-08-31', 'salesman_id' => $referralOnlySalesman->salesman_id],
    ]);
    $project->accountingTransactions()->create([
        'type' => 'receivable', 'category' => 'Customer Payment',
        'transaction_date' => '2026-08-31', 'amount' => 12000, 'status' => 'deposit',
    ]);

    $this->actingAs($admin)->getJson(route('management.projects.commission-breakdown', $project))
        ->assertOk()
        ->assertJsonPath('salesmen.0.salesman_name', $primarySalesman->salesman_name)
        ->assertJsonPath('salesmen.0.original_sale', 5000)
        ->assertJsonPath('salesmen.0.change_orders', 1000)
        ->assertJsonPath('salesmen.1.salesman_name', 'Overview Salesman Two')
        ->assertJsonPath('salesmen.1.original_sale', 5000)
        ->assertJsonPath('salesmen.1.change_orders', 1000)
        ->assertJsonPath('salesmen.1.total_sale', 6000)
        ->assertJsonPath('salesmen.1.commission_rate', 50)
        ->assertJsonPath('salesmen.2.salesman_name', 'Referral Only Salesman')
        ->assertJsonPath('salesmen.2.original_sale', 0)
        ->assertJsonPath('salesmen.2.change_orders', 2000)
        ->assertJsonPath('salesmen.2.commission_rate', 30);

    $project->sales()->where('type', 'referral')->update([
        'salesman_id' => $secondarySalesman->salesman_id,
    ]);
    $project->accountingTransactions()->create([
        'type' => 'payable',
        'category' => 'Vendor Payment',
        'transaction_date' => '2026-08-31',
        'amount' => 2000,
        'status' => 'paid',
    ]);

    $this->getJson(route('management.projects.commission-breakdown', $project))
        ->assertOk()
        ->assertJsonPath('salesmen.0.total_sale', 12000)
        ->assertJsonPath('salesmen.0.expenses', 2000)
        ->assertJsonPath('salesmen.0.lead_cost', 2000)
        ->assertJsonPath('salesmen.0.change_order_lead_cost', 400)
        ->assertJsonPath('salesmen.0.commission_base', 7600)
        ->assertJsonPath('salesmen.0.commission_rate', 50)
        ->assertJsonPath('salesmen.0.commission_due', 3800)
        ->assertJsonPath('salesmen.1.original_sale', 0)
        ->assertJsonPath('salesmen.1.total_sale', 2000)
        ->assertJsonPath('salesmen.1.expenses', 333.33)
        ->assertJsonPath('salesmen.1.lead_cost', 0)
        ->assertJsonPath('salesmen.1.change_order_lead_cost', 400)
        ->assertJsonPath('salesmen.1.commission_base', 1266.67)
        ->assertJsonPath('salesmen.1.commission_rate', 25)
        ->assertJsonPath('salesmen.1.commission_due', 316.67);

    Project::query()->whereKey($project->id)->update(['status' => 'completed']);

    $this->getJson(route('management.salesmen.report', $secondarySalesman))
        ->assertOk()
        ->assertJsonPath('summary.sale_total', 12000)
        ->assertJsonPath('commission.summary.projects', 1)
        ->assertJsonPath('commission.rows.0.total_sale', 2000)
        ->assertJsonPath('commission.rows.0.commission_due', 316.67);
});

test('a referral salesman shares only the assigned referral while the original salesman shares every sale', function () {
    $admin = Account::query()->create([
        'username' => 'referral-commission-admin@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $originalSalesman = Salesman::query()->create([
        'salesman_name' => 'Original Salesman',
        'initial_sale_cut_percent' => 10,
        'change_order_cut_percent' => 10,
        'sale_commission_percent' => 50,
    ]);
    $referralSalesman = Salesman::query()->create([
        'salesman_name' => 'Referral Salesman',
        'initial_sale_cut_percent' => 10,
        'change_order_cut_percent' => 20,
        'sale_commission_percent' => 50,
        'shared_sale_commission_percent' => 40,
    ]);
    $project = Project::query()->create([
        'project_number' => 'SBH#REF-1',
        'customer_name' => 'Referral Customer',
        'salesman_id' => $originalSalesman->salesman_id,
        'amount' => 10000,
        'status' => 'completed',
        'created_by' => $admin->acc_id,
    ]);
    $project->sales()->createMany([
        ['type' => 'original', 'amount' => 10000, 'sale_date' => '2026-08-28'],
        [
            'type' => 'referral',
            'amount' => 5000,
            'sale_date' => '2026-08-28',
            'salesman_id' => $referralSalesman->salesman_id,
        ],
    ]);
    $project->accountingTransactions()->create([
        'type' => 'receivable', 'category' => 'Customer Payment',
        'transaction_date' => '2026-08-28', 'amount' => 15000, 'status' => 'deposit',
    ]);

    $this->actingAs($admin)
        ->getJson(route('management.projects.commission-breakdown', $project))
        ->assertOk()
        ->assertJsonPath('salesmen.0.salesman_name', 'Original Salesman')
        ->assertJsonPath('salesmen.0.original_sale', 10000)
        ->assertJsonPath('salesmen.0.change_orders', 5000)
        ->assertJsonPath('salesmen.0.total_sale', 15000)
        ->assertJsonPath('salesmen.0.project_balance', 0)
        ->assertJsonPath('salesmen.0.commission_due', 6750)
        ->assertJsonPath('salesmen.1.salesman_name', 'Referral Salesman')
        ->assertJsonPath('salesmen.1.original_sale', 0)
        ->assertJsonPath('salesmen.1.change_orders', 5000)
        ->assertJsonPath('salesmen.1.total_sale', 5000)
        ->assertJsonPath('salesmen.1.project_balance', 0)
        ->assertJsonPath('salesmen.1.commission_rate', 40)
        ->assertJsonPath('salesmen.1.commission_due', 1600);
});

test('sale-linked receipts unlock commission only for their related sale', function () {
    $admin = Account::query()->create(['username' => 'linked-sale@example.com', 'password' => 'password', 'role' => 'admin']);
    $original = Salesman::query()->create(['salesman_name' => 'Original Owner', 'sale_commission_percent' => 50]);
    $referral = Salesman::query()->create(['salesman_name' => 'Referral Owner', 'shared_sale_commission_percent' => 25]);
    $project = Project::query()->create([
        'project_number' => 'SBH#LINKED', 'customer_name' => 'Linked Sale Customer',
        'salesman_id' => $original->salesman_id, 'amount' => 10000,
        'status' => 'completed', 'created_by' => $admin->acc_id,
    ]);
    $project->sales()->create(['type' => 'original', 'amount' => 10000, 'sale_date' => '2026-08-31']);
    $referralSale = $project->sales()->create([
        'type' => 'referral', 'amount' => 5000, 'sale_date' => '2026-08-31',
        'salesman_id' => $referral->salesman_id,
    ]);
    $project->accountingTransactions()->create([
        'project_sale_id' => $referralSale->id, 'type' => 'receivable',
        'category' => 'Customer Payment', 'transaction_date' => '2026-08-31',
        'amount' => 5000, 'status' => 'deposit',
    ]);

    $this->actingAs($admin)->getJson(route('management.projects.commission-breakdown', $project))
        ->assertOk()
        ->assertJsonPath('salesmen.0.received', 5000)
        ->assertJsonPath('salesmen.0.project_balance', 10000)
        ->assertJsonPath('salesmen.0.commission_due', 2500)
        ->assertJsonPath('salesmen.1.received', 5000)
        ->assertJsonPath('salesmen.1.project_balance', 0)
        ->assertJsonPath('salesmen.1.commission_due', 1250)
        ->assertJsonPath('salesmen.1.sale_breakdown.0.sale_id', $referralSale->id);
});
