<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Lead;
use App\Models\Salesman;
use App\Services\LeadGeocodingService;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

function bookingBoardLead(Agent $agent, Salesman $salesman, string $customer): Lead
{
    return Lead::query()->create([
        'customer_name' => $customer,
        'marital_status' => 'Single',
        'primary_number' => '555-0100',
        'address' => '100 Main Street',
        'zip_code' => '90001',
        'city' => 'Los Angeles',
        'county' => 'Los Angeles',
        'state' => 'CA',
        'years_in_house' => 5,
        'appointment_at' => now()->addDay()->setTime(10, 0),
        'telemarketer_notes' => 'Test booking',
        'source' => 'Test',
        'agent_id' => $agent->agent_id,
        'salesman_1_id' => $salesman->salesman_id,
        'created_by' => $agent->account_id,
        'status' => 'dispatched',
    ]);
}

test('admins see all bookings and runtime map configuration', function () {
    config(['services.maptiler.browser_key' => 'browser-test-key']);
    $admin = Account::query()->create([
        'username' => 'booking-admin@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $agentAccount = Account::query()->create([
        'username' => 'booking-agent@example.com',
        'password' => 'password',
        'role' => 'agent',
    ]);
    $agent = Agent::query()->create([
        'agent_name' => 'Booking Agent',
        'account_id' => $agentAccount->acc_id,
    ]);
    $first = Salesman::query()->create(['salesman_name' => 'First Salesman']);
    $second = Salesman::query()->create(['salesman_name' => 'Second Salesman']);
    bookingBoardLead($agent, $first, 'First Customer');
    bookingBoardLead($agent, $second, 'Second Customer');

    $this->actingAs($admin)
        ->get(route('lead-workflow.booking-board'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/booking-board')
            ->has('leads', 2)
            ->has('salesmen', 2)
            ->where('map.key', 'browser-test-key')
            ->where('viewerRole', 'admin'));
});

test('salesmen only receive their assigned bookings', function () {
    $agentAccount = Account::query()->create([
        'username' => 'scope-agent@example.com',
        'password' => 'password',
        'role' => 'agent',
    ]);
    $agent = Agent::query()->create([
        'agent_name' => 'Scope Agent',
        'account_id' => $agentAccount->acc_id,
    ]);
    $salesmanAccount = Account::query()->create([
        'username' => 'assigned-salesman@example.com',
        'password' => 'password',
        'role' => 'salesman',
    ]);
    $assigned = Salesman::query()->create([
        'salesman_name' => 'Assigned Salesman',
        'account_id' => $salesmanAccount->acc_id,
    ]);
    $other = Salesman::query()->create(['salesman_name' => 'Other Salesman']);
    $assigned->permissions()->create([
        'module' => 'booking_board',
        'access_level' => 'view',
    ]);
    bookingBoardLead($agent, $assigned, 'Visible Customer');
    $secondaryAssignment = bookingBoardLead($agent, $other, 'Secondary Customer');
    $secondaryAssignment->update([
        'salesman_2_id' => $assigned->salesman_id,
    ]);
    bookingBoardLead($agent, $other, 'Hidden Customer');
    $unassigned = bookingBoardLead($agent, $other, 'Unassigned Customer');
    $unassigned->update([
        'salesman_1_id' => null,
        'salesman_2_id' => null,
    ]);

    $this->actingAs($salesmanAccount)
        ->get(route('lead-workflow.booking-board'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('leads', 2)
            ->where('leads.0.customer_name', 'Visible Customer')
            ->where('leads.1.customer_name', 'Secondary Customer')
            ->has('salesmen', 1)
            ->where('salesmen.0.salesman_id', $assigned->salesman_id));
});

test('salesman accounts without a linked profile cannot see unassigned bookings', function () {
    $account = Account::query()->create([
        'username' => 'unlinked-salesman@example.com',
        'password' => 'password',
        'role' => 'salesman',
    ]);

    $this->actingAs($account)
        ->get(route('lead-workflow.booking-board'))
        ->assertForbidden();
});

test('confirmed leads do not appear until they are dispatched', function () {
    $admin = Account::query()->create([
        'username' => 'dispatch-only-admin@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $agentAccount = Account::query()->create([
        'username' => 'dispatch-only-agent@example.com',
        'password' => 'password',
        'role' => 'agent',
    ]);
    $agent = Agent::query()->create([
        'agent_name' => 'Dispatch Only Agent',
        'account_id' => $agentAccount->acc_id,
    ]);
    $salesman = Salesman::query()->create([
        'salesman_name' => 'Dispatch Salesman',
    ]);
    bookingBoardLead($agent, $salesman, 'Dispatched Customer');
    bookingBoardLead($agent, $salesman, 'Confirmed Customer')->update([
        'status' => 'confirmed',
    ]);

    $this->actingAs($admin)
        ->get(route('lead-workflow.booking-board'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('leads', 1)
            ->where('leads.0.customer_name', 'Dispatched Customer'));
});

test('the geocoder stores MapTiler coordinates on a lead', function () {
    config(['services.maptiler.api_key' => 'server-test-key']);
    Http::fake([
        'api.maptiler.com/*' => Http::response([
            'features' => [[
                'geometry' => [
                    'coordinates' => [-118.243683, 34.052235],
                ],
            ]],
        ]),
    ]);
    $account = Account::query()->create([
        'username' => 'geocoder-agent@example.com',
        'password' => 'password',
        'role' => 'agent',
    ]);
    $agent = Agent::query()->create([
        'agent_name' => 'Geocoder Agent',
        'account_id' => $account->acc_id,
    ]);
    $salesman = Salesman::query()->create(['salesman_name' => 'Map Salesman']);
    $lead = bookingBoardLead($agent, $salesman, 'Mapped Customer');

    expect(app(LeadGeocodingService::class)->geocode($lead))->toBeTrue();

    $lead->refresh();
    expect($lead->longitude)->toBe(-118.243683)
        ->and($lead->latitude)->toBe(34.052235)
        ->and($lead->geocoding_status)->toBe('geocoded')
        ->and($lead->geocoded_at)->not->toBeNull();
});
