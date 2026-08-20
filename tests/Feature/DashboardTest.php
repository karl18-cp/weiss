<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Company;
use App\Models\Lead;
use App\Models\Manager;
use App\Models\Product;
use App\Models\Project;
use App\Models\Salesman;
use App\Models\Team;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
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
        ->has('teamFilters')
        ->has('teamPerformance', 0)
        ->has('salesmanPerformance', 0)
        ->has('bookingPressure')
        ->has('projectHealth')
        ->has('workflowLanes', 5)
        ->has('topSources', 0));
});

test('team dashboard supports a customizable date range and normalizes reversed dates', function () {
    $account = Account::create([
        'username' => 'dashboard-range@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);

    $this->actingAs($account)
        ->get(route('team-dashboard', [
            'period' => 'range',
            'date' => '2026-08-15',
            'from' => '2026-08-15',
            'to' => '2026-08-10',
        ]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.period', 'range')
            ->where('filters.from', '2026-08-10')
            ->where('filters.to', '2026-08-15')
            ->where('range.start', '2026-08-10')
            ->where('range.end', '2026-08-15'));
});

test('team performance uses lead creation dates and reports confirmed and sold totals', function () {
    $account = Account::create([
        'username' => 'team-dashboard@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $manager = Manager::create([
        'account_id' => $account->acc_id,
        'manager_name' => 'Team Manager',
        'phone' => '5550000001',
        'manager_types' => ['manager'],
    ]);
    $company = Company::create([
        'com_id' => 1,
        'company' => 'Test Company',
        'address' => '1 Company Street',
        'prefix' => 'TEST',
        'project_code' => 'TEST',
    ]);
    $product = Product::create(['product_name' => 'Test Product']);
    $agent = Agent::create(['agent_name' => 'Team Agent']);
    $salesman = Salesman::create([
        'salesman_name' => 'Test Salesman',
        'phone' => '5550000002',
        'company_id' => $company->com_id,
    ]);
    $team = Team::create([
        'team_name' => 'Test Team',
        'manager_id' => $manager->manager_id,
    ]);
    $team->agents()->attach($agent->agent_id);

    $makeLead = function (string $name, string $status, string $createdAt, string $appointmentAt) use ($account, $agent, $company, $product, $salesman): Lead {
        $lead = Lead::create([
            'customer_name' => $name,
            'marital_status' => 'Single',
            'primary_number' => '5550000000',
            'address' => '1 Test Street',
            'zip_code' => '90001',
            'city' => 'Los Angeles',
            'county' => 'Los Angeles',
            'state' => 'CA',
            'years_in_house' => 1,
            'product_id' => $product->prod_id,
            'appointment_at' => $appointmentAt,
            'telemarketer_notes' => 'Test',
            'company_id' => $company->com_id,
            'source' => 'Test',
            'agent_id' => $agent->agent_id,
            'salesman_1_id' => $salesman->salesman_id,
            'created_by' => $account->acc_id,
            'status' => $status,
        ]);
        $lead->timestamps = false;
        $lead->forceFill(['created_at' => $createdAt])->saveQuietly();
        DB::table('lead_movements')
            ->where('lead_id', $lead->id)
            ->update(['created_at' => $createdAt, 'updated_at' => $createdAt]);

        return $lead;
    };

    $inside = CarbonImmutable::create(2026, 7, 29, 10, 0, 0, 'America/Los_Angeles')->utc();
    $makeLead('Confirmed Lead', 'confirmed', $inside->toDateTimeString(), '2026-07-29 10:00:00');
    $sold = $makeLead('Sold Lead', 'project', $inside->addHour()->toDateTimeString(), '2026-07-29 11:00:00');
    $movedFromDispatch = $makeLead('Dispatched Lead', 'dispatched', $inside->addHours(2)->toDateTimeString(), '2026-07-29 12:00:00');
    $movedFromDispatch->update(['status' => 'rehash']);
    $makeLead('Outside Lead', 'confirmed', $inside->subDay()->toDateTimeString(), '2026-07-28 10:00:00');
    $makeLead('Appointment In Range', 'confirmed', $inside->subDays(5)->toDateTimeString(), '2026-07-29 13:00:00');
    Project::create([
        'lead_id' => $sold->id,
        'amount' => 1000,
        'status' => 'new',
        'created_by' => $account->acc_id,
    ]);
    DB::table('lead_movements')->insert([
        [
            'lead_id' => $sold->id,
            'from_status' => 'rehash',
            'to_status' => 'fresh',
            'moved_by' => $account->acc_id,
            'created_at' => '2026-07-29 17:00:00',
            'updated_at' => '2026-07-29 17:00:00',
        ],
        [
            'lead_id' => $sold->id,
            'from_status' => 'fresh',
            'to_status' => 'confirmed',
            'moved_by' => $account->acc_id,
            'created_at' => '2026-07-29 18:00:00',
            'updated_at' => '2026-07-29 18:00:00',
        ],
        [
            'lead_id' => $sold->id,
            'from_status' => 'confirmed',
            'to_status' => 'dispatched',
            'moved_by' => $account->acc_id,
            'created_at' => '2026-07-29 19:00:00',
            'updated_at' => '2026-07-29 19:00:00',
        ],
    ]);

    $this->actingAs($account)
        ->get(route('dashboard', ['team_from' => '2026-07-29', 'team_to' => '2026-07-29']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('teamFilters.from', '2026-07-29')
            ->where('teamFilters.to', '2026-07-29')
            ->where('teamPerformance.0.name', 'Test Team')
            ->where('teamPerformance.0.manager', 'Team Manager')
            ->where('teamPerformance.0.total', 3)
            ->where('teamPerformance.0.confirmed', 1)
            ->where('teamPerformance.0.sold', 1)
            ->where('teamPerformance.0.agents.0.name', 'Team Agent')
            ->where('teamPerformance.0.agents.0.total', 3)
            ->where('teamPerformance.0.agents.0.confirmed', 1)
            ->where('teamPerformance.0.agents.0.sold', 1)
            ->where('salesmanPerformance.0.name', 'Test Salesman')
            ->where('salesmanPerformance.0.assigned', 2)
            ->where('salesmanPerformance.0.sold', 1)
            ->where('managerPerformance.0.name', 'Team Manager')
            ->where('managerPerformance.0.total', 1)
            ->where('managerPerformance.0.confirmed', 1)
            ->where('managerPerformance.0.dispatched', 1)
            ->where('managerPerformance.0.sold', 1));
});

test('team dashboard reports total confirmed and sold counts for each team', function () {
    $account = Account::create([
        'username' => 'team-scoreboard@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $manager = Manager::create([
        'account_id' => $account->acc_id,
        'manager_name' => 'Scoreboard Manager',
        'phone' => '5550000011',
        'manager_types' => ['manager'],
    ]);
    $company = Company::create([
        'company' => 'Scoreboard Company',
        'address' => '1 Company Street',
        'prefix' => 'SCORE',
        'project_code' => 'SCORE#001',
    ]);
    $product = Product::create(['product_name' => 'Scoreboard Product']);
    $agent = Agent::create([
        'agent_name' => 'Scoreboard Agent',
        'calltools_user_id' => 'scoreboard-calltools-user',
    ]);
    $absentAgent = Agent::create([
        'agent_name' => 'Absent Scoreboard Agent',
        'calltools_user_id' => 'absent-calltools-user',
    ]);
    $team = Team::create([
        'team_name' => 'Scoreboard Team',
        'manager_id' => $manager->manager_id,
    ]);
    $team->agents()->attach($agent->agent_id);
    $team->agents()->attach($absentAgent->agent_id);

    DB::table('calltools_user_login_shifts')->insert([
        'calltools_id' => 'scoreboard-shift',
        'app_user_id' => 'scoreboard-calltools-user',
        'started_at' => '2026-07-29 17:00:00',
        'stopped_at' => '2026-07-30 01:00:00',
        'duration_seconds' => 28800,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $makeLead = function (
        string $name,
        string $status,
        string $createdAt,
        string $appointmentAt = '2026-07-30 12:00:00',
    ) use ($account, $agent, $company, $product): Lead {
        $lead = Lead::create([
            'customer_name' => $name,
            'marital_status' => 'Single',
            'primary_number' => '5550000099',
            'address' => '1 Score Street',
            'zip_code' => '90001',
            'city' => 'Los Angeles',
            'county' => 'Los Angeles',
            'state' => 'CA',
            'years_in_house' => 1,
            'product_id' => $product->prod_id,
            'appointment_at' => $appointmentAt,
            'telemarketer_notes' => 'Test',
            'company_id' => $company->com_id,
            'source' => 'Test',
            'agent_id' => $agent->agent_id,
            'created_by' => $account->acc_id,
            'status' => $status,
        ]);
        $lead->timestamps = false;
        $lead->forceFill(['created_at' => $createdAt])->saveQuietly();
        DB::table('lead_movements')
            ->where('lead_id', $lead->id)
            ->update(['created_at' => $createdAt, 'updated_at' => $createdAt]);

        return $lead;
    };

    $inside = CarbonImmutable::create(2026, 7, 29, 10, 0, 0, 'America/Los_Angeles')->utc();
    $makeLead('Confirmed Score', 'confirmed', $inside->toDateTimeString());
    $makeLead('Dispatched Score', 'dispatched', $inside->addHour()->toDateTimeString());
    $sold = $makeLead(
        'Sold Score',
        'project',
        $inside->addHours(2)->toDateTimeString(),
        '2026-07-29 12:00:00',
    );
    $makeLead('Outside Score', 'confirmed', $inside->subDay()->toDateTimeString());
    Project::create([
        'lead_id' => $sold->id,
        'amount' => 1000,
        'status' => 'new',
        'created_by' => $account->acc_id,
    ]);
    $earlierSold = $makeLead(
        'Earlier Lead Sold On Appointment Day',
        'project',
        $inside->subDays(5)->toDateTimeString(),
        '2026-07-29 15:00:00',
    );
    Project::create([
        'lead_id' => $earlierSold->id,
        'amount' => 2000,
        'status' => 'new',
        'created_by' => $account->acc_id,
    ]);
    $returnedToDispatch = $makeLead(
        'Returned Sale',
        'dispatched',
        $inside->subDays(4)->toDateTimeString(),
        '2026-07-29 16:00:00',
    );
    Project::create([
        'lead_id' => $returnedToDispatch->id,
        'amount' => 2500,
        'status' => 'canceled',
        'created_by' => $account->acc_id,
    ]);
    $differentAppointmentDay = $makeLead(
        'Created Today But Sold On Another Appointment Day',
        'project',
        $inside->addHours(3)->toDateTimeString(),
        '2026-07-30 09:00:00',
    );
    Project::create([
        'lead_id' => $differentAppointmentDay->id,
        'amount' => 3000,
        'status' => 'new',
        'created_by' => $account->acc_id,
    ]);

    $this->actingAs($account)
        ->get(route('team-dashboard', ['period' => 'daily', 'date' => '2026-07-29']))
        ->assertInertia(fn (Assert $page) => $page
            ->component('team-dashboard')
            ->where('filters.timezone', 'America/Los_Angeles')
            ->where('summary.workedAgents', 1)
            ->where('summary.confirmed', 2)
            ->where('summary.dispatched', 1)
            ->where('summary.sold', 2)
            ->where('teams.0.name', 'Scoreboard Team')
            ->where('teams.0.total', 4)
            ->where('teams.0.confirmed', 2)
            ->where('teams.0.sold', 2)
            ->where('teams.0.agents.0.name', 'Scoreboard Agent')
            ->where('teams.0.agents.0.total', 4)
            ->where('teams.0.agents.0.confirmed', 2)
            ->where('teams.0.agents.0.sold', 2)
            ->where('teams.0.agents.0.worked', true)
            ->where('teams.0.agents.1.name', 'Absent Scoreboard Agent')
            ->where('teams.0.agents.1.worked', false));
});

test('team dashboard treats a live calltools login as worked before its shift is imported', function () {
    $this->travelTo(CarbonImmutable::create(2026, 8, 11, 12, 0, 0, 'America/Los_Angeles'));
    $account = Account::query()->create([
        'username' => 'live-dashboard@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $manager = Manager::query()->create([
        'account_id' => $account->acc_id,
        'manager_name' => 'Live Dashboard Manager',
        'phone' => '',
        'manager_types' => ['manager'],
    ]);
    $agent = Agent::query()->create([
        'agent_name' => 'Live Dashboard Agent',
        'calltools_user_id' => 'live-dashboard-agent',
    ]);
    $team = Team::query()->create([
        'team_name' => 'Live Dashboard Team',
        'manager_id' => $manager->manager_id,
    ]);
    $team->agents()->attach($agent->agent_id);
    DB::table('calltools_agent_daily_metrics')->insert([
        'app_user_id' => 'live-dashboard-agent',
        'metric_date' => now('UTC')->toDateString(),
        'logged_in' => true,
        'logged_in_since' => now('UTC')->subHour(),
        'captured_at' => now('UTC'),
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $this->actingAs($account)
        ->get(route('team-dashboard', ['period' => 'daily', 'date' => '2026-08-11']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.workedAgents', 1)
            ->where('teams.0.agents.0.name', 'Live Dashboard Agent')
            ->where('teams.0.agents.0.worked', true));
});

test('team dashboard does not count zero-duration calltools shift placeholders as worked', function () {
    $account = Account::query()->create([
        'username' => 'placeholder-dashboard@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $manager = Manager::query()->create([
        'account_id' => $account->acc_id,
        'manager_name' => 'Placeholder Dashboard Manager',
        'phone' => '',
        'manager_types' => ['manager'],
    ]);
    $agent = Agent::query()->create([
        'agent_name' => 'Not Logged In Agent',
        'calltools_user_id' => 'not-logged-in-agent',
    ]);
    $team = Team::query()->create([
        'team_name' => 'Placeholder Dashboard Team',
        'manager_id' => $manager->manager_id,
    ]);
    $team->agents()->attach($agent->agent_id);

    DB::table('calltools_user_login_shifts')->insert([
        'calltools_id' => 'zero-duration-placeholder',
        'app_user_id' => 'not-logged-in-agent',
        'started_at' => '2026-08-13 16:00:00',
        'stopped_at' => null,
        'duration_seconds' => 0,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $this->actingAs($account)
        ->get(route('team-dashboard', ['period' => 'daily', 'date' => '2026-08-13']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.workedAgents', 0)
            ->where('teams.0.agents.0.worked', false));
});
