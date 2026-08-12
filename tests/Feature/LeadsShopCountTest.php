<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Company;
use App\Models\Lead;
use App\Models\LeadMovement;
use App\Models\Manager;
use App\Models\ManagerPermission;
use App\Models\Product;
use App\Models\Salesman;
use App\Models\Team;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

function createCallbackManager(string $username, bool $canViewAll = false): Account
{
    $account = Account::query()->create([
        'username' => $username,
        'password' => 'password',
        'role' => 'manager',
    ]);
    $manager = Manager::query()->create([
        'account_id' => $account->acc_id,
        'manager_name' => $username,
        'phone' => '',
        'manager_types' => ['Leads Manager'],
    ]);
    ManagerPermission::query()->create([
        'manager_id' => $manager->manager_id,
        'module' => 'leads_shop',
        'access_level' => 'view',
    ]);
    ManagerPermission::query()->create([
        'manager_id' => $manager->manager_id,
        'module' => 'view_all_callbacks',
        'access_level' => $canViewAll ? 'edit' : 'none',
    ]);

    return $account;
}

function createOwnedCallbackLead(Account $creator, Account $owner, Agent $agent, string $name): Lead
{
    $lead = Lead::query()->create([
        'customer_name' => $name,
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000888',
        'address' => '8 Callback Street',
        'zip_code' => '90001',
        'city' => 'Los Angeles',
        'county' => '',
        'state' => 'CA',
        'years_in_house' => 0,
        'telemarketer_notes' => '',
        'source' => 'CallTools',
        'agent_id' => $agent->agent_id,
        'created_by' => $creator->acc_id,
        'status' => 'fresh',
    ]);

    Lead::query()->whereKey($lead->id)->update(['status' => 'cb']);
    LeadMovement::query()->create([
        'lead_id' => $lead->id,
        'from_status' => 'fresh',
        'to_status' => 'cb',
        'moved_by' => $owner->acc_id,
    ]);

    return $lead->fresh();
}

test('leads shop keeps the last 30 dates visible when they have no leads', function () {
    $account = Account::query()->create([
        'username' => 'empty-date-navigator-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $today = now('America/Los_Angeles')->toDateString();
    $oldestVisibleDate = now('America/Los_Angeles')->subDays(29)->toDateString();

    $this->actingAs($account)
        ->get(route('lead-workflow.leads-shop'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('selectedDate', $today)
            ->has('dateRows', 30)
            ->where('dateRows.0.key', $today)
            ->where('dateRows.0.count', 0)
            ->where('dateRows.29.key', $oldestVisibleDate)
            ->where('dateRows.29.count', 0));
});

test('leads shop header counts manager returns from restricted workflow tabs', function () {
    $firstManager = createCallbackManager('Return Counter Manager One');
    $secondManager = createCallbackManager('Return Counter Manager Two');
    $admin = Account::query()->create([
        'username' => 'return-counter-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $agent = Agent::query()->create(['agent_name' => 'Return Counter Agent']);
    $firstLead = createOwnedCallbackLead($admin, $firstManager, $agent, 'First Returned Lead');
    $secondLead = createOwnedCallbackLead($admin, $secondManager, $agent, 'Second Returned Lead');

    LeadMovement::query()->create([
        'lead_id' => $firstLead->id,
        'from_status' => 'his',
        'to_status' => 'fresh',
        'moved_by' => $firstManager->acc_id,
    ]);
    LeadMovement::query()->create([
        'lead_id' => $secondLead->id,
        'from_status' => 'reschedule',
        'to_status' => 'fresh',
        'moved_by' => $secondManager->acc_id,
    ]);

    $this->actingAs($admin)
        ->get(route('lead-workflow.leads-shop'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('agentDayTotal', 0)
            ->where('overallDayTotal', 2)
            ->where('managerReturns.leads', 2)
            ->where('managerReturns.managers', 2));
});

test('managers only see callbacks they moved into the callback queue', function () {
    $firstManager = createCallbackManager('Callback Manager One');
    $secondManager = createCallbackManager('Callback Manager Two');
    $admin = Account::query()->create(['username' => 'callback-owner-admin', 'password' => 'password', 'role' => 'admin']);
    $agent = Agent::query()->create(['agent_name' => 'Callback Ownership Agent']);

    createOwnedCallbackLead($admin, $firstManager, $agent, 'First Manager Callback');
    createOwnedCallbackLead($admin, $secondManager, $agent, 'Second Manager Callback');

    $this->actingAs($firstManager)
        ->get(route('lead-workflow.leads-shop'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('leads', 1)
            ->where('leads.0.customer_name', 'First Manager Callback'));
});

test('a manager with callback visibility permission sees every managers callbacks', function () {
    $viewer = createCallbackManager('Callback Manager Viewer', true);
    $otherManager = createCallbackManager('Callback Manager Other');
    $admin = Account::query()->create(['username' => 'callback-view-admin', 'password' => 'password', 'role' => 'admin']);
    $agent = Agent::query()->create(['agent_name' => 'Callback Visibility Agent']);

    createOwnedCallbackLead($admin, $viewer, $agent, 'Viewer Callback');
    createOwnedCallbackLead($admin, $otherManager, $agent, 'Other Manager Callback');

    $this->actingAs($viewer)
        ->get(route('lead-workflow.leads-shop'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('leads', 2)
            ->where('leads', fn ($leads): bool => collect($leads)
                ->pluck('customer_name')
                ->sort()
                ->values()
                ->all() === ['Other Manager Callback', 'Viewer Callback']));
});

test('leads shop only loads and counts leads that remain in its statuses', function () {
    $account = Account::query()->create([
        'username' => 'shop-count-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $company = Company::query()->create([
        'com_id' => 801,
        'company' => 'Shop Count Company',
        'address' => '',
        'prefix' => 'SC',
        'project_code' => 'SC-001',
    ]);
    $product = Product::query()->create(['product_name' => 'Shop Count Product']);
    $agent = Agent::query()->create(['agent_name' => 'Shop Count Agent']);

    $makeLead = function (string $status, string $name) use ($account, $company, $product, $agent): Lead {
        return Lead::query()->create([
            'customer_name' => $name,
            'marital_status' => 'Unknown',
            'primary_number' => '+15550000000',
            'address' => '1 Test Street',
            'zip_code' => '00000',
            'city' => 'Test City',
            'county' => 'Test County',
            'state' => 'CA',
            'years_in_house' => 0,
            'product_id' => $product->prod_id,
            'appointment_at' => now(),
            'telemarketer_notes' => 'Test note',
            'company_id' => $company->com_id,
            'source' => 'CallTools',
            'agent_id' => $agent->agent_id,
            'created_by' => $account->acc_id,
            'status' => $status,
        ]);
    };

    $makeLead('fresh', 'Fresh Shop Lead');
    $makeLead('raw', 'Raw Shop Lead');
    $makeLead('verify', 'Verify Shop Lead');
    $confirmedLead = $makeLead('confirmed', 'Moved To Confirmation');
    $confirmedLead->update(['city' => 'Confirmation Only City']);
    $dispatchedLead = $makeLead('dispatched', 'Moved To Dispatch');
    $dispatchedLead->update(['city' => 'Dispatch Only City']);
    $makeLead('project', 'Converted Project');

    $this->actingAs($account)
        ->get(route('lead-workflow.leads-shop'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/leads-shop')
            ->has('leads', 3)
            ->where('leads', fn ($leads): bool => collect($leads)
                ->pluck('customer_name')
                ->sort()
                ->values()
                ->all() === ['Fresh Shop Lead', 'Raw Shop Lead', 'Verify Shop Lead'])
            ->where('cities', ['Test City'])
        );

    $this->get(route('lead-workflow.confirm-leads'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/confirm-leads')
            ->where('cities', ['Confirmation Only City'])
        );

    $this->get(route('lead-workflow.dispatch-leads'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/dispatch-leads')
            ->where('cities', ['Dispatch Only City'])
        );
});

test('a verify lead creation date can be corrected and updates its initial movement', function () {
    $account = Account::query()->create([
        'username' => 'verify-date-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $company = Company::query()->create([
        'com_id' => 91001,
        'company' => 'Verify Date Company',
        'address' => '',
        'prefix' => 'VD',
        'project_code' => 'VD-001',
    ]);
    $product = Product::query()->create(['product_name' => 'Verify Date Product']);
    $agent = Agent::query()->create(['agent_name' => 'Verify Date Agent']);
    $lead = Lead::query()->create([
        'customer_name' => 'Transferred Verify Lead',
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000000',
        'address' => '1 Archive Street',
        'zip_code' => '00000',
        'city' => 'Archive City',
        'county' => '',
        'state' => 'CA',
        'years_in_house' => 0,
        'product_id' => $product->prod_id,
        'appointment_at' => '2026-08-20 13:00:00',
        'telemarketer_notes' => 'Transferred note',
        'company_id' => $company->com_id,
        'source' => 'CallTools',
        'agent_id' => $agent->agent_id,
        'created_by' => $account->acc_id,
        'status' => 'verify',
    ]);

    $this->actingAs($account)
        ->put(route('lead-workflow.leads-shop.update', $lead), [
            'lead_created_at' => '2026-06-15T09:30',
            'customer_name' => $lead->customer_name,
            'marital_status' => $lead->marital_status,
            'primary_number' => $lead->primary_number,
            'address' => $lead->address,
            'zip_code' => $lead->zip_code,
            'city' => $lead->city,
            'state' => $lead->state,
            'years_in_house' => $lead->years_in_house,
            'product_id' => $product->prod_id,
            'appointment_at' => $lead->appointment_at->format('Y-m-d H:i:s'),
            'company_id' => $company->com_id,
            'source' => 'CallTools',
            'agent_id' => $agent->agent_id,
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    expect($lead->fresh()->getRawOriginal('created_at'))
        ->toBe('2026-06-15 16:30:00')
        ->and($lead->movements()->reorder()->oldest('created_at')->firstOrFail()->getRawOriginal('created_at'))
        ->toBe('2026-06-15 16:30:00');
});

test('verify queue is not constrained by the selected lead created date', function () {
    $account = Account::query()->create([
        'username' => 'verify-queue-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $company = Company::query()->create([
        'company' => 'Verify Queue Company',
        'address' => '',
        'prefix' => 'VQ',
        'project_code' => 'VQ-001',
    ]);
    $product = Product::query()->create(['product_name' => 'Verify Queue Product']);
    $agent = Agent::query()->create(['agent_name' => 'Verify Queue Agent']);

    foreach ([
        ['Old Verify Lead', 'verify', '2026-07-01 12:00:00'],
        ['New Verify Lead', 'verify', '2026-08-05 12:00:00'],
        ['Same Day Fresh Lead', 'fresh', '2026-08-05 13:00:00'],
        ['Old NG Lead', 'ng', '2026-07-02 13:00:00'],
    ] as [$name, $status, $createdAt]) {
        $lead = Lead::query()->create([
            'customer_name' => $name,
            'marital_status' => 'Unknown',
            'primary_number' => '+15550000000',
            'address' => '1 Verify Street',
            'zip_code' => '00000',
            'city' => 'Verify City',
            'county' => 'Verify County',
            'state' => 'CA',
            'years_in_house' => 0,
            'product_id' => $product->prod_id,
            'appointment_at' => '2026-08-05 14:00:00',
            'telemarketer_notes' => 'Verify note',
            'company_id' => $company->com_id,
            'source' => 'CallTools',
            'agent_id' => $agent->agent_id,
            'created_by' => $account->acc_id,
            'status' => $status,
        ]);
        $lead->timestamps = false;
        $lead->forceFill(['created_at' => $createdAt, 'updated_at' => $createdAt])->save();
    }

    $this->actingAs($account)
        ->get(route('lead-workflow.leads-shop', [
            'date' => '2026-08-05',
            'date_field' => 'created_at',
            'queue_status' => 'verify',
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/leads-shop')
            ->where('activeShopStatus', 'verify')
            ->where('verifyCount', 2)
            ->where('leads.per_page', 25)
            ->where('leads.total', 2)
            ->has('leads.data', 2)
            ->where('leads.data', fn ($leads): bool => collect($leads)
                ->pluck('customer_name')
                ->sort()
                ->values()
                ->all() === ['New Verify Lead', 'Old Verify Lead']));

    $this->get(route('lead-workflow.leads-shop', [
        'queue_status' => 'ng',
    ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('activeShopStatus', 'ng')
            ->where('ngCount', 1)
            ->where('leads.per_page', 25)
            ->where('leads.total', 1)
            ->where('leads.data.0.customer_name', 'Old NG Lead'));
});

test('a requested dispatched booking is loaded and selected in the leads shop', function () {
    $account = Account::query()->create([
        'username' => 'booking-link-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $agent = Agent::query()->create(['agent_name' => 'Booking Link Agent']);
    $lead = Lead::query()->create([
        'customer_name' => 'Requested Booking',
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000003',
        'address' => '3 Test Street',
        'zip_code' => '00000',
        'city' => 'Test City',
        'county' => 'Test County',
        'state' => 'CA',
        'years_in_house' => 0,
        'appointment_at' => now(),
        'telemarketer_notes' => '',
        'source' => 'CallTools',
        'agent_id' => $agent->agent_id,
        'created_by' => $account->acc_id,
        'status' => 'dispatched',
    ]);

    $this->actingAs($account)
        ->get(route('lead-workflow.leads-shop', ['lead' => $lead->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/leads-shop')
            ->has('leads', 1)
            ->where('leads.0.id', $lead->id)
        );
});

test('leads shop defaults to today and counts current destinations for leads created today', function () {
    $account = Account::query()->create([
        'username' => 'movement-count-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $company = Company::query()->create([
        'company' => 'Movement Count Company',
        'address' => '',
        'prefix' => 'MC',
        'project_code' => 'MC-001',
    ]);
    $product = Product::query()->create(['product_name' => 'Movement Count Product']);
    $agent = Agent::query()->create(['agent_name' => 'Movement Count Agent']);
    $outsideTeamAgent = Agent::query()->create(['agent_name' => 'Outside Team Agent']);
    $manager = Manager::query()->create([
        'manager_name' => 'Movement Count Manager',
        'account_id' => $account->acc_id,
        'phone' => '',
        'manager_types' => [],
    ]);
    $team = Team::query()->create([
        'team_name' => 'Movement Count Team',
        'manager_id' => $manager->manager_id,
    ]);
    $team->agents()->attach($agent->agent_id);
    $lead = Lead::query()->create([
        'customer_name' => 'Moved Today',
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000009',
        'address' => '9 Test Street',
        'zip_code' => '00000',
        'city' => 'Test City',
        'county' => 'Test County',
        'state' => 'CA',
        'years_in_house' => 0,
        'product_id' => $product->prod_id,
        'appointment_at' => now()->addWeek(),
        'telemarketer_notes' => 'Test note',
        'company_id' => $company->com_id,
        'source' => 'CallTools',
        'calltools_contact_id' => 'ct-moved-today',
        'agent_id' => $agent->agent_id,
        'created_by' => $account->acc_id,
        'status' => 'fresh',
    ]);
    $lead->update(['status' => 'confirmed']);

    $californiaToday = CarbonImmutable::today('America/Los_Angeles');
    $afterUtcMidnight = $californiaToday->setTime(17, 45)->utc();
    $utcNextDateLead = Lead::query()->create([
        'customer_name' => 'UTC Next Date California Today',
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000039',
        'address' => '39 Test Street',
        'zip_code' => '00000',
        'city' => 'Test City',
        'county' => 'Test County',
        'state' => 'CA',
        'years_in_house' => 0,
        'product_id' => $product->prod_id,
        'appointment_at' => now()->addWeek(),
        'telemarketer_notes' => 'UTC boundary lead',
        'company_id' => $company->com_id,
        'source' => 'CallTools',
        'calltools_contact_id' => 'ct-utc-next-date',
        'agent_id' => $agent->agent_id,
        'created_by' => $account->acc_id,
        'status' => 'fresh',
        'created_at' => $afterUtcMidnight,
        'updated_at' => $afterUtcMidnight,
    ]);
    $utcNextDateLead->movements()->update(['created_at' => $afterUtcMidnight]);

    Lead::query()->create([
        'customer_name' => 'Manual Lead Excluded From Distribution',
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000029',
        'address' => '29 Test Street',
        'zip_code' => '00000',
        'city' => 'Test City',
        'county' => 'Test County',
        'state' => 'CA',
        'years_in_house' => 0,
        'product_id' => $product->prod_id,
        'appointment_at' => now()->addWeek(),
        'telemarketer_notes' => 'Manual lead',
        'company_id' => $company->com_id,
        // Direct projects and other records outside scored teams must not
        // inflate the count even if legacy edits labelled them CallTools.
        'source' => 'CallTools',
        'agent_id' => $outsideTeamAgent->agent_id,
        'created_by' => $account->acc_id,
        'status' => 'dispatched',
    ]);

    $olderLead = Lead::query()->create([
        'customer_name' => 'Created Earlier Moved Today',
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000019',
        'address' => '19 Test Street',
        'zip_code' => '00000',
        'city' => 'Test City',
        'county' => 'Test County',
        'state' => 'CA',
        'years_in_house' => 0,
        'product_id' => $product->prod_id,
        'appointment_at' => now()->addWeek(),
        'telemarketer_notes' => 'Older test note',
        'company_id' => $company->com_id,
        'source' => 'CallTools',
        'calltools_contact_id' => 'ct-created-earlier',
        'agent_id' => $agent->agent_id,
        'created_by' => $account->acc_id,
        'status' => 'fresh',
        'created_at' => now()->subDay(),
        'updated_at' => now()->subDay(),
    ]);
    $olderLead->movements()->update(['created_at' => now()->subDay()]);
    $olderLead->update(['status' => 'confirmed']);
    $today = now('America/Los_Angeles')->toDateString();

    $this->actingAs($account)
        ->get(route('lead-workflow.leads-shop'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('selectedDate', $today)
            ->where('createdDayTotal', 2)
            ->where('movementDestinations.0.status', 'leads_shop')
            ->where('movementDestinations.0.count', 1)
            ->where('movementDestinations.1.status', 'confirmed')
            ->where('movementDestinations.1.count', 1)
            ->where('movementDestinations.2.status', 'dispatched')
            ->where('movementDestinations.2.count', 0)
            ->where('movementDestinations', fn ($destinations) => $destinations
                ->sum('count') === 2));

    $confirmationDate = now('America/Los_Angeles')->addWeek()->toDateString();

    $this->get(route('lead-workflow.confirm-leads'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('selectedDate', $confirmationDate));
});

test('his expands the current month into dates and keeps past months grouped', function () {
    $this->travelTo('2026-08-11 12:00:00');
    $account = Account::query()->create([
        'username' => 'his-month-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $agent = Agent::query()->create(['agent_name' => 'HIS Month Agent']);

    foreach ([
        ['July One', '2026-07-02 09:00:00'],
        ['July Two', '2026-07-29 15:30:00'],
        ['June One', '2026-06-18 11:00:00'],
        ['August One', '2026-08-03 11:00:00'],
        ['August Two', '2026-08-10 09:00:00'],
    ] as [$name, $appointment]) {
        Lead::query()->create([
            'customer_name' => $name,
            'marital_status' => 'Unknown',
            'primary_number' => '+15550000010',
            'address' => '10 Test Street',
            'zip_code' => '00000',
            'city' => 'Test City',
            'county' => 'Test County',
            'state' => 'CA',
            'years_in_house' => 0,
            'appointment_at' => $appointment,
            'telemarketer_notes' => '',
            'source' => 'CallTools',
            'agent_id' => $agent->agent_id,
            'created_by' => $account->acc_id,
            'status' => 'his',
        ]);
    }

    $leadWithoutAppointment = Lead::query()->create([
        'customer_name' => 'July Without Appointment',
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000011',
        'address' => '11 Test Street',
        'zip_code' => '00000',
        'city' => 'Test City',
        'county' => 'Test County',
        'state' => 'CA',
        'years_in_house' => 0,
        'appointment_at' => null,
        'telemarketer_notes' => '',
        'source' => 'CallTools',
        'agent_id' => $agent->agent_id,
        'created_by' => $account->acc_id,
        'status' => 'his',
    ]);
    $leadWithoutAppointment->timestamps = false;
    $leadWithoutAppointment->forceFill([
        'created_at' => '2026-07-12 10:00:00',
        'updated_at' => '2026-07-12 10:00:00',
    ])->saveQuietly();

    $this->actingAs($account)
        ->get(route('lead-workflow.his', ['date' => '2026-07']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/his')
            ->where('dateGranularity', 'hybrid')
            ->where('selectedDate', '2026-07')
            ->where('dateRows.0.key', '2026-08-10')
            ->where('dateRows.0.count', 1)
            ->where('dateRows.1.key', '2026-08-03')
            ->where('dateRows.1.count', 1)
            ->where('dateRows.2.key', '2026-07')
            ->where('dateRows.2.count', 3)
            ->where('dateRows.3.key', '2026-06')
            ->where('dateRows.3.count', 1)
            ->has('leads.data', 3));

    $this->get(route('lead-workflow.his', ['date' => '2026-08-10']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('selectedDate', '2026-08-10')
            ->has('leads.data', 1)
            ->where('leads.data.0.customer_name', 'August Two'));
});

test('salesmen are redirected away from the full CRM leads shop', function () {
    $agentAccount = Account::query()->create([
        'username' => 'booking-link-agent',
        'password' => 'password',
        'role' => 'agent',
    ]);
    $agent = Agent::query()->create([
        'account_id' => $agentAccount->acc_id,
        'agent_name' => 'Booking Link Agent',
    ]);
    $salesmanAccount = Account::query()->create([
        'username' => 'booking-link-salesman',
        'password' => 'password',
        'role' => 'salesman',
    ]);
    Salesman::query()->create([
        'account_id' => $salesmanAccount->acc_id,
        'salesman_name' => 'Booking Link Salesman',
    ]);
    $otherSalesman = Salesman::query()->create([
        'salesman_name' => 'Other Booking Salesman',
    ]);
    $lead = Lead::query()->create([
        'customer_name' => 'Other Salesman Booking',
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000004',
        'address' => '4 Test Street',
        'zip_code' => '00000',
        'city' => 'Test City',
        'county' => 'Test County',
        'state' => 'CA',
        'years_in_house' => 0,
        'appointment_at' => now(),
        'telemarketer_notes' => '',
        'source' => 'CallTools',
        'agent_id' => $agent->agent_id,
        'salesman_1_id' => $otherSalesman->salesman_id,
        'created_by' => $agentAccount->acc_id,
        'status' => 'dispatched',
    ]);

    $this->actingAs($salesmanAccount)
        ->get(route('lead-workflow.leads-shop', ['lead' => $lead->id]))
        ->assertRedirect(route('salesman.booking-board'));
});

test('lead status changes record where it moved and who moved it', function () {
    $creator = Account::query()->create([
        'username' => 'movement-creator',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $mover = Account::query()->create([
        'username' => 'movement-user',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $company = Company::query()->create([
        'com_id' => 802,
        'company' => 'Movement Company',
        'address' => '',
        'prefix' => 'MV',
        'project_code' => 'MV-001',
    ]);
    $product = Product::query()->create(['product_name' => 'Movement Product']);
    $agent = Agent::query()->create(['agent_name' => 'Movement Agent']);
    $lead = Lead::query()->create([
        'customer_name' => 'Moving Lead',
        'marital_status' => 'Married',
        'primary_number' => '+15550000001',
        'address' => '2 Test Street',
        'zip_code' => '00000',
        'city' => 'Test City',
        'county' => 'Test County',
        'state' => 'CA',
        'years_in_house' => 0,
        'house_age' => 25,
        'needs_financing' => true,
        'house_value' => 650000,
        'crm_qualification_completed_at' => now(),
        'product_id' => $product->prod_id,
        'appointment_at' => now(),
        'telemarketer_notes' => '',
        'company_id' => $company->com_id,
        'source' => 'CallTools',
        'agent_id' => $agent->agent_id,
        'created_by' => $creator->acc_id,
        'status' => 'fresh',
    ]);

    $this->actingAs($mover)
        ->patch(route('lead-workflow.leads-shop.status.update', $lead), [
            'status' => 'confirmed',
        ])
        ->assertRedirect();

    $movement = LeadMovement::query()->latest('id')->firstOrFail();

    expect($movement->lead_id)->toBe($lead->id)
        ->and($movement->from_status)->toBe('fresh')
        ->and($movement->to_status)->toBe('confirmed')
        ->and($movement->moved_by)->toBe($mover->acc_id);
});

test('an incomplete calltools lead can leave leads shop', function () {
    $account = Account::query()->create([
        'username' => 'incomplete-lead-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $agent = Agent::query()->create(['agent_name' => 'Incomplete Lead Agent']);
    $lead = Lead::query()->create([
        'customer_name' => 'Incomplete CallTools Lead',
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000007',
        'address' => '7 Test Street',
        'zip_code' => '00000',
        'city' => 'Test City',
        'county' => 'Test County',
        'state' => 'CA',
        'years_in_house' => 0,
        'appointment_at' => now(),
        'telemarketer_notes' => '',
        'source' => 'CallTools',
        'agent_id' => $agent->agent_id,
        'created_by' => $account->acc_id,
        'status' => 'fresh',
    ]);

    $this->actingAs($account)
        ->patch(route('lead-workflow.leads-shop.status.update', $lead), [
            'status' => 'confirmed',
        ])
        ->assertRedirect();

    expect($lead->fresh()->status)->toBe('confirmed');
});

test('admins can permanently delete sample leads', function () {
    $admin = Account::query()->create([
        'username' => 'sample-delete-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $agent = Agent::query()->create(['agent_name' => 'Sample Delete Agent']);
    $lead = Lead::query()->create([
        'customer_name' => 'Disposable Sample Lead',
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000005',
        'address' => '5 Test Street',
        'zip_code' => '00000',
        'city' => 'Test City',
        'county' => 'Test County',
        'state' => 'CA',
        'years_in_house' => 0,
        'telemarketer_notes' => 'Sample',
        'source' => 'Sample',
        'agent_id' => $agent->agent_id,
        'created_by' => $admin->acc_id,
        'status' => 'fresh',
    ]);

    $this->actingAs($admin)
        ->delete(route('lead-workflow.leads-shop.destroy', $lead))
        ->assertRedirect();

    $this->assertDatabaseMissing('leads', ['id' => $lead->id]);
});

test('admins can delete a lead and its linked project together', function () {
    $admin = Account::query()->create([
        'username' => 'project-delete-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $agent = Agent::query()->create(['agent_name' => 'Project Delete Agent']);
    $lead = Lead::query()->create([
        'customer_name' => 'Project Linked Lead',
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000015',
        'address' => '15 Test Street',
        'zip_code' => '00000',
        'city' => 'Test City',
        'county' => 'Test County',
        'state' => 'CA',
        'years_in_house' => 0,
        'telemarketer_notes' => 'Sample',
        'source' => 'Sample',
        'agent_id' => $agent->agent_id,
        'created_by' => $admin->acc_id,
        'status' => 'fresh',
    ]);
    $project = \App\Models\Project::query()->create([
        'lead_id' => $lead->id,
        'amount' => 1000,
        'created_by' => $admin->acc_id,
    ]);

    $this->actingAs($admin)
        ->from(route('lead-workflow.leads-shop'))
        ->delete(route('lead-workflow.leads-shop.destroy', $lead))
        ->assertRedirect(route('lead-workflow.leads-shop'));

    $this->assertDatabaseMissing('leads', ['id' => $lead->id]);
    $this->assertDatabaseMissing('projects', ['id' => $project->id]);
});

test('non-admin accounts cannot permanently delete leads', function () {
    $account = Account::query()->create([
        'username' => 'sample-delete-agent',
        'password' => 'password',
        'role' => 'agent',
    ]);
    $agent = Agent::query()->create([
        'account_id' => $account->acc_id,
        'agent_name' => 'Restricted Delete Agent',
    ]);
    $agent->permissions()->create([
        'module' => 'leads_shop',
        'access_level' => 'edit',
    ]);
    $lead = Lead::query()->create([
        'customer_name' => 'Protected Lead',
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000006',
        'address' => '6 Test Street',
        'zip_code' => '00000',
        'city' => 'Test City',
        'county' => 'Test County',
        'state' => 'CA',
        'years_in_house' => 0,
        'telemarketer_notes' => '',
        'source' => 'Sample',
        'agent_id' => $agent->agent_id,
        'created_by' => $account->acc_id,
        'status' => 'fresh',
    ]);

    $this->actingAs($account)
        ->from(route('lead-workflow.leads-shop'))
        ->delete(route('lead-workflow.leads-shop.destroy', $lead))
        ->assertForbidden();

    $this->assertDatabaseHas('leads', ['id' => $lead->id]);
});
