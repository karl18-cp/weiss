<?php

use App\Models\Account;
use App\Models\Proposal;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

test('an administrator can open and create a standalone proposal with calculated totals', function () {
    Storage::fake('local');
    $admin = Account::query()->create([
        'username' => 'proposal-admin@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);

    $this->actingAs($admin)
        ->get('/management/proposals')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('management/proposals')
            ->where('canEdit', true)
            ->has('statuses'));

    $this->actingAs($admin)->post('/management/proposals', [
        'project_id' => null,
        'lead_id' => null,
        'customer_name' => 'Jordan Customer',
        'email' => 'jordan@example.com',
        'phone' => '4085551212',
        'address' => '10 Main Street',
        'city' => 'San Jose',
        'state' => 'CA',
        'zip_code' => '95112',
        'status' => 'Draft',
        'issue_date' => '2026-08-27',
        'expires_at' => '2026-09-27',
        'scope' => 'Complete the approved scope.',
        'exclusions' => null,
        'payment_schedule' => '50% deposit, 50% completion.',
        'terms' => 'Thirty day validity.',
        'notes' => null,
        'discount' => 100,
        'tax_rate' => 10,
        'items' => [[
            'product_id' => null,
            'name' => 'Construction service',
            'description' => 'Labor and materials',
            'quantity' => 2,
            'unit' => 'Each',
            'unit_price' => 1000,
        ]],
    ])->assertRedirect();

    $proposal = Proposal::query()->with('items')->firstOrFail();
    expect($proposal->proposal_number)->toBe('PRP-2026-0001')
        ->and((float) $proposal->subtotal)->toBe(2000.0)
        ->and((float) $proposal->tax_amount)->toBe(190.0)
        ->and((float) $proposal->total)->toBe(2090.0)
        ->and($proposal->items)->toHaveCount(1);

    $this->actingAs($admin)
        ->post("/management/proposals/{$proposal->id}/generate")
        ->assertRedirect();

    $version = $proposal->versions()->firstOrFail();
    Storage::disk('local')->assertExists($version->file_path);
});
