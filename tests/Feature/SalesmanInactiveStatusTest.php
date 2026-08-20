<?php

use App\Models\Account;
use App\Models\Company;
use App\Models\Salesman;
use App\Support\ManagerAccess;
use Inertia\Testing\AssertableInertia as Assert;

test('a salesman without a login account can be moved to inactive and restored', function () {
    $admin = Account::query()->create([
        'username' => 'salesman-status-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $company = Company::query()->create([
        'com_id' => 91001,
        'company' => 'Status Company',
        'address' => '1 Status Way',
        'prefix' => 'STA',
        'project_code' => 'STA',
    ]);
    $salesman = Salesman::query()->create([
        'salesman_name' => 'Directory Only Salesman',
        'phone' => '555-0100',
        'company_id' => $company->com_id,
    ]);
    $permissions = collect(ManagerAccess::MODULES)
        ->mapWithKeys(fn (string $label, string $module): array => [$module => 'none'])
        ->all();
    $payload = [
        'salesman_name' => $salesman->salesman_name,
        'phone' => $salesman->phone,
        'company_id' => $company->com_id,
        'username' => null,
        'password' => null,
        'permissions' => $permissions,
    ];

    $this->actingAs($admin)
        ->put(route('management.salesmen.update', $salesman), [
            ...$payload,
            'suspended' => true,
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect($salesman->refresh()->inactive_at)->not->toBeNull();

    $this->actingAs($admin)
        ->get(route('management.salesmen'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('salesmen.0.salesman_id', $salesman->salesman_id)
            ->where('salesmen.0.inactive_at', fn ($value) => filled($value)));

    $this->actingAs($admin)
        ->put(route('management.salesmen.update', $salesman), [
            ...$payload,
            'suspended' => false,
        ])
        ->assertRedirect();

    expect($salesman->refresh()->inactive_at)->toBeNull();
});
