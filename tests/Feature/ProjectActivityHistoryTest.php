<?php

use App\Models\Account;
use App\Models\Project;

test('project changes and related accounting records are written to project history', function () {
    $admin = Account::query()->create([
        'username' => 'project-history-admin@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);

    $this->actingAs($admin);

    $project = Project::query()->create([
        'project_number' => 'SBH#HISTORY-1',
        'customer_name' => 'History Customer',
        'amount' => 10000,
        'status' => 'new',
        'created_by' => $admin->acc_id,
    ]);
    $project->update(['amount' => 12000]);
    $project->accountingTransactions()->create([
        'type' => 'receivable',
        'category' => 'Customer Payment',
        'transaction_date' => '2026-09-09',
        'amount' => 3000,
        'status' => 'deposit',
    ]);

    $logs = $project->activityLogs()->get()->sortBy('id')->values();

    expect($logs)->toHaveCount(3)
        ->and($logs[0]->description)->toBe('Project created')
        ->and($logs[1]->old_values['amount'])->toBe('10000.00')
        ->and($logs[1]->new_values['amount'])->toBe(12000)
        ->and($logs[2]->description)->toBe('Receivable created')
        ->and($logs[2]->actor_id)->toBe($admin->acc_id);
});
