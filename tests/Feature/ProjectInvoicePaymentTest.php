<?php

use App\Models\Account;
use App\Models\Project;

test('an invoice becomes paid when its linked paid payables reduce the balance to zero', function () {
    $account = Account::query()->create([
        'username' => 'invoice-payment-test@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $this->actingAs($account);

    $project = Project::query()->create([
        'project_number' => 'SBH#INVOICE-PAYMENT',
        'customer_name' => 'Invoice Payment Customer',
        'amount' => 1000,
        'status' => 'new',
        'created_by' => $account->acc_id,
    ]);
    $invoice = $project->invoices()->create([
        'invoice_number' => 'INV#PAYMENT',
        'invoice_date' => '2026-09-09',
        'amount' => 500,
        'status' => 'pending',
    ]);
    $project->accountingTransactions()->create([
        'project_invoice_id' => $invoice->id,
        'type' => 'payable',
        'category' => 'Pending Vendor Payment',
        'transaction_date' => '2026-09-09',
        'amount' => 100,
        'status' => 'pending',
    ]);
    $paid = $project->accountingTransactions()->create([
        'project_invoice_id' => $invoice->id,
        'type' => 'payable',
        'category' => 'Vendor Payment',
        'transaction_date' => '2026-09-09',
        'amount' => 500,
        'status' => 'paid',
    ]);

    expect($invoice->refresh()->status)->toBe('paid');

    $paid->update(['amount' => 400]);

    expect($invoice->refresh()->status)->toBe('ok_to_pay');
});
