<?php

use App\Models\Account;
use Illuminate\Support\Facades\RateLimiter;

test('login screen can be rendered', function () {
    $response = $this->get(route('login'));

    $response->assertOk();
});

test('users can authenticate using the login screen', function () {
    $account = Account::create([
        'username' => 'admin@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);

    $response = $this->post(route('login.store'), [
        'username' => $account->username,
        'password' => 'password',
    ]);

    $this->assertAuthenticated();
    $response->assertRedirect(route('dashboard', absolute: false));
});

test('users can not authenticate with invalid password', function () {
    $account = Account::create([
        'username' => 'user@example.com',
        'password' => 'password',
        'role' => 'user',
    ]);

    $this->post(route('login.store'), [
        'username' => $account->username,
        'password' => 'wrong-password',
    ]);

    $this->assertGuest();
});

test('users can logout', function () {
    $account = Account::create([
        'username' => 'logout@example.com',
        'password' => 'password',
        'role' => 'user',
    ]);

    $response = $this->actingAs($account)->post(route('logout'));

    $response->assertRedirect(route('home'));

    $this->assertGuest();
});

test('users are rate limited', function () {
    $account = Account::create([
        'username' => 'limited@example.com',
        'password' => 'password',
        'role' => 'user',
    ]);

    RateLimiter::increment(md5('login'.implode('|', [$account->username, '127.0.0.1'])), amount: 5);

    $response = $this->post(route('login.store'), [
        'username' => $account->username,
        'password' => 'wrong-password',
    ]);

    $response->assertTooManyRequests();
});
