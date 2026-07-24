<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Company;
use App\Models\Contractor;
use App\Models\Lead;
use App\Models\Product;
use App\Models\Salesman;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

function projectSaleFixtures(): array
{
    $account = Account::query()->create([
        'username' => 'project-sale-admin@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $company = Company::query()->create([
        'com_id' => 1,
        'company' => 'Project Company',
        'address' => '',
        'prefix' => 'PC',
        'project_code' => 'PC-001',
    ]);
    $product = Product::query()->create(['product_name' => 'Windows']);
    $agent = Agent::query()->create(['agent_name' => 'Project Agent']);
    $salesman = Salesman::query()->create(['salesman_name' => 'Project Salesman']);
    $lead = Lead::query()->create([
        'customer_name' => 'Project Customer',
        'marital_status' => 'Single',
        'primary_number' => '555-1000',
        'mobile_number' => '555-2000',
        'address' => '100 Project Way',
        'zip_code' => '90001',
        'city' => 'Los Angeles',
        'county' => 'Los Angeles',
        'state' => 'CA',
        'years_in_house' => 4,
        'product_id' => $product->prod_id,
        'appointment_at' => now()->addDay(),
        'telemarketer_notes' => 'Project note',
        'company_id' => $company->com_id,
        'source' => 'CallTools',
        'agent_id' => $agent->agent_id,
        'created_by' => $account->acc_id,
        'status' => 'dispatched',
    ]);

    return compact('account', 'lead', 'salesman');
}

test('a sale requires an assigned salesman', function () {
    ['account' => $account, 'lead' => $lead] = projectSaleFixtures();

    $this->actingAs($account)
        ->post(route('lead-workflow.leads-shop.sale', $lead), [
            'amount' => 12500,
        ])
        ->assertSessionHasErrors('salesman');

    $this->assertDatabaseMissing('projects', ['lead_id' => $lead->id]);
    expect($lead->refresh()->status)->toBe('dispatched');
});

test('assigning a salesman is recorded in lead history', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();

    $this->actingAs($account)
        ->patch(route('lead-workflow.leads-shop.salesmen.update', $lead), [
            'salesman_1_id' => $salesman->salesman_id,
            'salesman_2_id' => null,
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('lead_notes', [
        'lead_id' => $lead->id,
        'note_type' => 'salesman_sent',
        'body' => "Salesman Sent: {$salesman->salesman_name} (Salesman 1).",
        'created_by' => $account->acc_id,
    ]);
});

test('accepting a sale creates a related project', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);

    $response = $this->actingAs($account)
        ->post(route('lead-workflow.leads-shop.sale', $lead), [
            'amount' => 12500.50,
        ]);

    $this->assertDatabaseHas('projects', [
        'lead_id' => $lead->id,
        'amount' => 12500.50,
        'status' => 'new',
        'created_by' => $account->acc_id,
    ]);
    expect($lead->refresh())
        ->status->toBe('project')
        ->appointment_result->toBe('Sold')
        ->project->not->toBeNull();
    $response->assertRedirect(route('management.projects', [
        'project' => $lead->project->id,
    ]));
    $this->assertDatabaseHas('project_sales', [
        'project_id' => $lead->project->id,
        'type' => 'original',
        'amount' => 12500.50,
    ]);

    $this->actingAs($account)
        ->get(route('management.projects'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('management/projects')
            ->has('projects', 1)
            ->where('projects.0.lead_id', $lead->id)
            ->where('projects.0.status', 'new')
            ->where('projects.0.lead.company.prefix', 'PC')
            ->where('projects.0.lead.customer_name', 'Project Customer'),
        );
});

test('sold appointment results must use the sale workflow', function () {
    ['account' => $account, 'lead' => $lead] = projectSaleFixtures();

    $this->actingAs($account)
        ->patch(route('lead-workflow.leads-shop.appointment-result.update', $lead), [
            'appointment_result' => 'Sold',
        ])
        ->assertSessionHasErrors('appointment_result');

    expect($lead->refresh()->appointment_result)->not->toBe('Sold');
    $this->assertDatabaseMissing('projects', ['lead_id' => $lead->id]);
});

test('project referral sales can be added edited and deleted', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);

    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), [
        'amount' => 12500,
    ]);

    $project = $lead->refresh()->project;
    $product = $lead->product;

    $this->post(route('management.projects.sales.store', $project), [
        'amount' => 2500,
        'sale_date' => '2026-07-16',
        'product_id' => $product->prod_id,
    ])->assertRedirect();

    $referral = $project->sales()->where('type', 'referral')->firstOrFail();
    $this->assertDatabaseHas('project_sales', [
        'id' => $referral->id,
        'amount' => 2500,
        'type' => 'referral',
    ]);

    $this->put(route('management.projects.sales.update', [$project, $referral]), [
        'amount' => 3000,
        'sale_date' => '2026-07-17',
        'product_id' => $product->prod_id,
    ])->assertRedirect();

    expect($referral->refresh())
        ->amount->toBe('3000.00')
        ->sale_date->toDateString()->toBe('2026-07-17');

    $this->delete(route('management.projects.sales.destroy', [$project, $referral]))
        ->assertRedirect();
    $this->assertDatabaseMissing('project_sales', ['id' => $referral->id]);
});

test('the original sale can be edited but cannot be deleted', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);

    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), [
        'amount' => 12500,
    ]);

    $project = $lead->refresh()->project;
    $original = $project->sales()->where('type', 'original')->firstOrFail();

    $this->put(route('management.projects.sales.update', [$project, $original]), [
        'amount' => 14000,
        'sale_date' => '2026-07-18',
        'product_id' => $lead->product_id,
    ])->assertRedirect();

    expect($project->refresh()->amount)->toBe('14000.00');
    expect($original->refresh()->amount)->toBe('14000.00');

    $this->delete(route('management.projects.sales.destroy', [$project, $original]))
        ->assertUnprocessable();
    $this->assertDatabaseHas('project_sales', ['id' => $original->id]);
});

test('project scheduled payments can be added edited and deleted', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);

    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), [
        'amount' => 12500,
    ]);

    $project = $lead->refresh()->project;

    $this->post(route('management.projects.scheduled-payments.store', $project), [
        'expected_date' => '2026-08-01',
        'payment_stage' => 'Down Payment',
        'amount' => 2500,
        'qb' => true,
        'printed_sent' => false,
        'notes' => 'Initial deposit',
    ])->assertRedirect();

    $scheduledPayment = $project->scheduledPayments()->firstOrFail();
    $this->assertDatabaseHas('scheduled_payments', [
        'id' => $scheduledPayment->id,
        'project_id' => $project->id,
        'amount' => 2500,
        'payment_stage' => 'Down Payment',
    ]);

    $this->put(route('management.projects.scheduled-payments.update', [$project, $scheduledPayment]), [
        'expected_date' => '2026-08-05',
        'payment_stage' => 'Upon Material Delivery',
        'amount' => 3000,
        'qb' => false,
        'printed_sent' => true,
        'notes' => 'Updated schedule',
    ])->assertRedirect();

    expect($scheduledPayment->refresh())
        ->amount->toBe('3000.00')
        ->payment_stage->toBe('Upon Material Delivery')
        ->printed_sent->toBeTrue();

    $this->delete(route('management.projects.scheduled-payments.destroy', [$project, $scheduledPayment]))
        ->assertRedirect();
    $this->assertDatabaseMissing('scheduled_payments', ['id' => $scheduledPayment->id]);
});

test('scheduled payments cannot exceed the project contract total', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);

    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), [
        'amount' => 10000,
    ]);

    $project = $lead->refresh()->project;
    $payload = [
        'expected_date' => '2026-08-01',
        'payment_stage' => 'Down Payment',
        'qb' => false,
        'printed_sent' => false,
        'notes' => null,
    ];

    $this->post(route('management.projects.scheduled-payments.store', $project), [
        ...$payload,
        'amount' => 7500,
    ])->assertRedirect();

    $this->post(route('management.projects.scheduled-payments.store', $project), [
        ...$payload,
        'amount' => 2500.01,
    ])->assertSessionHasErrors('amount');

    expect((float) $project->scheduledPayments()->sum('amount'))->toBe(7500.0);
});

test('a project sale cannot be reduced below its scheduled payments', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);

    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), [
        'amount' => 10000,
    ]);

    $project = $lead->refresh()->project;
    $original = $project->sales()->where('type', 'original')->firstOrFail();

    $this->post(route('management.projects.scheduled-payments.store', $project), [
        'expected_date' => '2026-08-01',
        'payment_stage' => 'Down Payment',
        'amount' => 9000,
        'qb' => false,
        'printed_sent' => false,
        'notes' => null,
    ]);

    $this->put(route('management.projects.sales.update', [$project, $original]), [
        'amount' => 8000,
        'sale_date' => '2026-07-18',
        'product_id' => $lead->product_id,
    ])->assertSessionHasErrors('amount');

    expect($original->refresh()->amount)->toBe('10000.00');
});

test('project vendor invoices support files editing statuses and deletion', function () {
    Storage::fake('local');
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);
    $contractor = Contractor::query()->create([
        'contractor' => 'Invoice Contractor',
        'address' => '200 Vendor Street',
        'zip' => 90001,
        'city' => 'Los Angeles',
        'state' => 'CA',
        'email' => 'vendor@example.com',
        'phone' => 5551000,
        'license' => 12345,
        'lic_expire' => '2027-01-01',
        'worker_comp' => '2027-01-01',
        'insurance_expire' => '2027-01-01',
    ]);

    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), [
        'amount' => 10000,
    ]);
    $project = $lead->refresh()->project;

    $this->post(route('management.projects.invoices.store', $project), [
        'invoice_number' => 'INV#1001',
        'invoice_date' => '2026-07-16',
        'contractor_id' => $contractor->con_id,
        'amount' => 1250.50,
        'notes' => 'Roofing materials',
        'file' => UploadedFile::fake()->create('invoice.pdf', 100, 'application/pdf'),
    ])->assertRedirect();

    $invoice = $project->invoices()->firstOrFail();
    expect($invoice)
        ->status->toBe('pending')
        ->file_name->toBe('invoice.pdf');
    Storage::disk('local')->assertExists($invoice->file_path);

    $this->get(route('lead-workflow.data.vendor-invoices'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/vendor-invoices')
            ->has('invoices.data', 1)
            ->where('invoices.data.0.id', $invoice->id)
            ->where('invoices.data.0.project_id', $project->id)
            ->where('invoices.data.0.invoice_number', 'INV#1001')
            ->where('invoices.data.0.contractor.contractor', 'Invoice Contractor'));

    $this->get(route('management.projects.invoices.file', [$project, $invoice]))
        ->assertOk();

    $this->post(route('management.projects.invoices.update', [$project, $invoice]), [
        'invoice_number' => 'INV#1001-UPDATED',
        'invoice_date' => '2026-07-17',
        'contractor_id' => $contractor->con_id,
        'amount' => 1500,
        'notes' => 'Updated invoice',
    ])->assertRedirect();

    $this->patch(route('management.projects.invoices.status', [$project, $invoice]), [
        'status' => 'ok_to_pay',
    ])->assertRedirect();

    expect($invoice->refresh())
        ->invoice_number->toBe('INV#1001-UPDATED')
        ->amount->toBe('1500.00')
        ->status->toBe('ok_to_pay');

    $filePath = $invoice->file_path;
    $this->delete(route('management.projects.invoices.destroy', [$project, $invoice]))
        ->assertRedirect();
    $this->assertDatabaseMissing('project_invoices', ['id' => $invoice->id]);
    Storage::disk('local')->assertMissing($filePath);
});

test('project accounting supports standalone receivables optional schedules and payables', function () {
    Storage::fake('local');
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);
    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), [
        'amount' => 10000,
    ]);
    $project = $lead->refresh()->project;
    $scheduledPayment = $project->scheduledPayments()->create([
        'expected_date' => '2026-08-01',
        'payment_stage' => 'Down Payment',
        'amount' => 2500,
        'qb' => false,
        'printed_sent' => false,
    ]);

    $receivable = [
        'type' => 'receivable',
        'category' => 'Customer Payment',
        'transaction_date' => '2026-07-16',
        'payment_method' => 'check',
        'reference_number' => 'CH#1001',
        'counterparty' => 'A different submitted customer',
        'amount' => 1000,
        'status' => 'pending',
        'notes' => 'Standalone deposit',
    ];

    $this->post(route('management.projects.accounting-transactions.store', $project), $receivable)
        ->assertRedirect();
    $transaction = $project->accountingTransactions()->firstOrFail();
    expect($transaction->scheduledPayments)->toHaveCount(0);
    expect($transaction->counterparty)->toBe('Project Customer');

    $this->put(route('management.projects.accounting-transactions.update', [$project, $transaction]), [
        ...$receivable,
        'payment_method' => 'zelle',
        'reference_number' => 'ZELLEabc123',
        'scheduled_payment_ids' => [$scheduledPayment->id],
    ])->assertRedirect();
    expect($transaction->refresh()->scheduledPayments)->toHaveCount(1);

    $this->put(route('management.projects.accounting-transactions.update', [$project, $transaction]), [
        ...$receivable,
        'payment_method' => 'zelle',
        'reference_number' => 'ZELLEabc123',
        'status' => 'ok_to_pay',
        'scheduled_payment_ids' => [$scheduledPayment->id],
    ])->assertRedirect();
    expect($transaction->refresh()->status)->toBe('ok_to_pay');

    $this->post(route('management.projects.accounting-transactions.store', $project), [
        ...$receivable,
        'reference_number' => 'CH#OVER-SCHEDULE',
        'amount' => 1501,
        'status' => 'paid',
        'scheduled_payment_ids' => [$scheduledPayment->id],
    ])->assertSessionHasErrors('amount');

    $this->post(route('management.projects.accounting-transactions.store', $project), [
        ...$receivable,
        'payment_method' => 'credit_card',
        'reference_number' => 'WRONG-100',
    ])->assertSessionHasErrors('reference_number');

    $contractor = Contractor::query()->create([
        'contractor' => 'Project Vendor',
        'address' => '300 Vendor Street',
        'zip' => 90001,
        'city' => 'Los Angeles',
        'state' => 'CA',
        'email' => 'payable@example.com',
        'phone' => 5552000,
    ]);
    $invoice = $project->invoices()->create([
        'contractor_id' => $contractor->con_id,
        'invoice_number' => 'INV#PAY-1',
        'invoice_date' => '2026-07-16',
        'amount' => 750,
        'status' => 'pending',
    ]);
    $payableFile = UploadedFile::fake()->create('payable.pdf', 100, 'application/pdf');

    $this->post(route('management.projects.accounting-transactions.store', $project), [
        ...$receivable,
        'type' => 'payable',
        'category' => 'Vendor Payment',
        'payment_method' => 'credit_card',
        'reference_number' => 'CC-5544',
        'counterparty' => 'Vendor',
        'amount' => 500,
        'status' => 'ok_to_pay',
        'contractor_id' => $contractor->con_id,
        'project_invoice_id' => $invoice->id,
        'file' => $payableFile,
    ])->assertRedirect();

    expect($project->accountingTransactions()->where('type', 'payable')->count())->toBe(1);
    $payable = $project->accountingTransactions()->where('type', 'payable')->firstOrFail();
    expect($payable)
        ->counterparty->toBe('Project Vendor')
        ->requested_by->toBe($account->username)
        ->file_name->toBe('payable.pdf');
    Storage::disk('local')->assertExists($payable->file_path);

    $this->post(route('management.projects.accounting-transactions.store', $project), [
        ...$receivable,
        'type' => 'payable',
        'category' => 'Vendor Payment',
        'reference_number' => 'CH#OVER',
        'amount' => 251,
        'status' => 'paid',
        'contractor_id' => $contractor->con_id,
        'project_invoice_id' => $invoice->id,
    ])->assertSessionHasErrors('amount');
    $this->delete(route('management.projects.accounting-transactions.destroy', [$project, $transaction]))
        ->assertRedirect();
    $this->assertDatabaseMissing('project_accounting_transactions', ['id' => $transaction->id]);
});
