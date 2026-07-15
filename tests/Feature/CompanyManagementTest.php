<?php

use App\Models\Account;
use App\Models\Company;

function companyAdmin(): Account
{
    return Account::query()->create([
        'username' => 'company-admin@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
}

test('admins can view and create companies', function () {
    $admin = companyAdmin();

    $this->actingAs($admin)
        ->get(route('management.contacts-users'))
        ->assertOk();

    $this->actingAs($admin)
        ->post(route('management.contacts-users.store'), [
            'company' => 'Bright Horizon',
            'address' => '',
            'prefix' => 'BH',
            'project_code' => 'BH-001',
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('companies', [
        'company' => 'Bright Horizon',
        'address' => '',
        'project_code' => 'BH-001',
    ]);
});

test('admins can update and delete companies', function () {
    $admin = companyAdmin();
    $company = Company::query()->create([
        'com_id' => 1,
        'company' => 'Old Company',
        'address' => 'Old Address',
        'prefix' => 'OLD',
        'project_code' => 'OLD-001',
    ]);

    $this->actingAs($admin)
        ->put(route('management.contacts-users.update', $company), [
            'company' => 'New Company',
            'address' => 'New Address',
            'prefix' => 'NEW',
            'project_code' => 'NEW-001',
        ])
        ->assertRedirect();

    expect($company->refresh()->company)->toBe('New Company');

    $this->actingAs($admin)
        ->delete(route('management.contacts-users.destroy', $company))
        ->assertRedirect();

    $this->assertDatabaseMissing('companies', ['com_id' => 1]);
});

test('non-admin accounts cannot change companies', function () {
    $account = Account::query()->create([
        'username' => 'standard-user@example.com',
        'password' => 'password',
        'role' => 'user',
    ]);

    $this->actingAs($account)
        ->post(route('management.contacts-users.store'), [
            'company' => 'Blocked Company',
            'address' => '123 Main Street',
            'prefix' => 'BC',
            'project_code' => 'BC-001',
        ])
        ->assertForbidden();
});
