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
            'price' => '125.50',
            'unit' => 'Square Foot',
            'description' => 'Foundation repair priced by square foot.',
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('products', [
        'product_name' => 'Foundation Repair',
        'price' => '125.50',
        'unit' => 'Square Foot',
        'description' => 'Foundation repair priced by square foot.',
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
            'price' => '75.00',
            'unit' => 'Each',
            'description' => 'Updated product description.',
        ])
        ->assertRedirect();

    expect($product->refresh())
        ->product_name->toBe('New Product')
        ->price->toBe('75.00')
        ->unit->toBe('Each')
        ->description->toBe('Updated product description.');

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
