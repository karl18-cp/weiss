<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Company;
use App\Models\Lead;
use App\Models\LeadNote;
use App\Models\Product;

function configureCallToolsWebhook(): array
{
    $company = Company::query()->create([
        'com_id' => 101,
        'company' => 'CallTools Company',
        'address' => '',
        'prefix' => 'CT',
        'project_code' => 'CT-001',
    ]);
    $product = Product::query()->create(['product_name' => 'Default Product']);
    $agent = Agent::query()->create(['agent_name' => 'Default Agent']);
    $account = Account::query()->create([
        'username' => 'calltools@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);

    config([
        'services.calltools.webhook_secret' => 'test-webhook-secret',
        'services.calltools.default_company_id' => $company->com_id,
        'services.calltools.default_product_id' => $product->prod_id,
        'services.calltools.default_agent_id' => $agent->agent_id,
        'services.calltools.created_by' => $account->acc_id,
    ]);

    return compact('company', 'product', 'agent', 'account');
}

test('calltools webhook requires its bearer token', function () {
    configureCallToolsWebhook();

    $this->postJson(route('webhooks.calltools'), [
        'contact_id' => 'contact-1',
        'phone_number' => '+15551234567',
    ])->assertUnauthorized();
});

test('calltools connector can authenticate with a form body secret', function () {
    configureCallToolsWebhook();

    $this->postJson(route('webhooks.calltools'), [
        'webhook_secret' => 'test-webhook-secret',
        'contact_id' => 'connector-auth-1',
        'phone_number' => '+15551234567',
    ])->assertCreated();
});

test('a valid body secret works even when calltools also sends an outdated bearer token', function () {
    configureCallToolsWebhook();

    $this->withToken('outdated-secret')
        ->postJson(route('webhooks.calltools'), [
            'webhook_secret' => 'test-webhook-secret',
            'contact_id' => 'connector-auth-2',
            'phone_number' => '+15557654321',
        ])
        ->assertCreated();
});

test('calltools webhook creates and updates one lead per contact', function () {
    configureCallToolsWebhook();
    $matchedAgent = Agent::query()->create(['agent_name' => 'CallTools Agent']);
    $matchedProduct = Product::query()->create(['product_name' => 'Electrical / Plumbing']);

    $payload = [
        'event' => 'contact.created',
        'contact_id' => 'contact-123',
        'first_name' => 'Jamie',
        'last_name' => 'Customer',
        'phone_number' => '+15551234567',
        'email' => 'jamie@example.com',
        'address' => '123 Main Street',
        'city' => 'Orlando',
        'state' => 'FL',
        'zip_code' => '32801',
        'notes' => 'Interested customer',
        'agent_name' => 'CallTools Agent',
        'campaign_name' => 'Summer Campaign',
        'product' => 'electrical',
        'appointment_at' => '2026-07-22 14:30:00',
    ];

    $this->withToken('test-webhook-secret')
        ->postJson(route('webhooks.calltools'), $payload)
        ->assertCreated()
        ->assertJsonPath('message', 'Lead created.')
        ->assertJsonPath('calltools_contact_id', 'contact-123');

    $lead = Lead::query()->where('calltools_contact_id', 'contact-123')->firstOrFail();

    expect($lead->customer_name)->toBe('Jamie Customer')
        ->and($lead->agent_id)->toBe($matchedAgent->agent_id)
        ->and($lead->product_id)->toBe($matchedProduct->prod_id)
        ->and($lead->appointment_at->format('Y-m-d H:i:s'))->toBe('2026-07-22 14:30:00')
        ->and($lead->calltools_campaign_name)->toBe('Summer Campaign');
    expect(LeadNote::query()
        ->where('lead_id', $lead->id)
        ->where('note_type', 'telemarketer')
        ->value('body'))->toBe('Interested customer');

    $this->withToken('test-webhook-secret')
        ->postJson(route('webhooks.calltools'), [
            ...$payload,
            'phone_number' => '+15557654321',
        ])
        ->assertOk()
        ->assertJsonPath('message', 'Lead updated.');

    expect(Lead::query()->where('calltools_contact_id', 'contact-123')->count())->toBe(1)
        ->and($lead->fresh()->primary_number)->toBe('+15557654321')
        ->and(LeadNote::query()->where('lead_id', $lead->id)->count())->toBe(1);
});

test('calltools webhook accepts native connector phone fields and derives a contact id', function () {
    configureCallToolsWebhook();

    $this->withToken('test-webhook-secret')
        ->postJson(route('webhooks.calltools'), [
            'first_name' => 'Connector',
            'last_name' => 'Contact',
            'mobile_primary' => '+1 (555) 123-4567',
        ])
        ->assertCreated()
        ->assertJsonPath('message', 'Lead created.');

    $lead = Lead::query()->where('primary_number', '+1 (555) 123-4567')->firstOrFail();

    expect($lead->calltools_contact_id)->toStartWith('phone-');
});
