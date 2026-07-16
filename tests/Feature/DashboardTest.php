<?php

use App\Models\Account;
use Inertia\Testing\AssertableInertia as Assert;

test('guests are redirected to the login page', function () {
    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('login'));
});

test('authenticated users can visit the dashboard', function () {
    $account = Account::create([
        'username' => 'dashboard@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $this->actingAs($account);

    $response = $this->get(route('dashboard'));
    $response->assertInertia(fn (Assert $page) => $page
        ->component('dashboard')
        ->where('metrics.totalLeads', 0)
        ->where('metrics.projects', 0)
        ->has('bookingPressure')
        ->has('projectHealth')
        ->has('workflowLanes', 5)
        ->has('topSources', 0));
});
