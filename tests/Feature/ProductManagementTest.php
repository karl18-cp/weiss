<?php

use App\Models\Account;
use App\Models\Product;

function productAdmin(): Account
{
    return Account::query()->create([
        'username' => 'product-admin@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
}

test('admins can view and create products', function () {
    $admin = productAdmin();

    $this->actingAs($admin)
        ->get(route('management.products'))
        ->assertOk();

    $this->actingAs($admin)
        ->post(route('management.products.store'), [
            'product_name' => 'Foundation Repair',
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('products', [
        'product_name' => 'Foundation Repair',
    ]);
});

test('admins can update and delete products', function () {
    $admin = productAdmin();
    $product = Product::query()->create([
        'product_name' => 'Old Product',
    ]);

    $this->actingAs($admin)
        ->put(route('management.products.update', $product), [
            'product_name' => 'New Product',
        ])
        ->assertRedirect();

    expect($product->refresh()->product_name)->toBe('New Product');

    $this->actingAs($admin)
        ->delete(route('management.products.destroy', $product))
        ->assertRedirect();

    $this->assertDatabaseMissing('products', [
        'product_name' => 'New Product',
    ]);
});

test('product names must be unique', function () {
    $admin = productAdmin();
    Product::query()->create(['product_name' => 'Existing Product']);

    $this->actingAs($admin)
        ->post(route('management.products.store'), [
            'product_name' => 'Existing Product',
        ])
        ->assertSessionHasErrors('product_name');
});
