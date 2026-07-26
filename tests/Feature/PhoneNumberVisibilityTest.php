<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Lead;
use App\Support\PhoneNumberVisibility;

test('admins can view full phone numbers', function () {
    $admin = Account::query()->create([
        'username' => 'phone-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);

    $this->actingAs($admin);

    expect(PhoneNumberVisibility::canView())->toBeTrue()
        ->and(PhoneNumberVisibility::mask('(555) 123-4567'))->toBe('*******567');
});

test('restricted users only receive the last three phone digits', function () {
    $account = Account::query()->create([
        'username' => 'restricted-phone-agent',
        'password' => 'password',
        'role' => 'agent',
    ]);
    Agent::query()->create([
        'account_id' => $account->acc_id,
        'agent_name' => 'Restricted Phone Agent',
    ]);

    $this->actingAs($account);

    $lead = new Lead([
        'primary_number' => '(555) 123-4567',
        'secondary_number' => '5559876543',
        'mobile_number' => null,
    ]);
    $data = $lead->toArray();

    expect(PhoneNumberVisibility::canView())->toBeFalse()
        ->and($data['primary_number'])->toBe('*******567')
        ->and($data['secondary_number'])->toBe('*******543')
        ->and($data['mobile_number'])->toBeNull();
});

test('users with phone visibility permission receive full numbers', function () {
    $account = Account::query()->create([
        'username' => 'permitted-phone-agent',
        'password' => 'password',
        'role' => 'agent',
    ]);
    $agent = Agent::query()->create([
        'account_id' => $account->acc_id,
        'agent_name' => 'Permitted Phone Agent',
    ]);
    $agent->permissions()->create([
        'module' => 'full_phone_numbers',
        'access_level' => 'view',
    ]);

    $this->actingAs($account);

    $lead = new Lead(['primary_number' => '(555) 123-4567']);

    expect(PhoneNumberVisibility::canView())->toBeTrue()
        ->and($lead->toArray()['primary_number'])->toBe('(555) 123-4567');
});
