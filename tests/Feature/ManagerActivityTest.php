<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Lead;
use App\Models\LeadMovement;
use App\Models\Manager;
use App\Models\RingCentralCall;
use Inertia\Testing\AssertableInertia as Assert;

function managerActivityFixtures(): array
{
    $firstAccount = Account::query()->create([
        'username' => 'activity-one@example.com',
        'password' => 'password',
        'role' => 'manager',
    ]);
    $secondAccount = Account::query()->create([
        'username' => 'activity-two@example.com',
        'password' => 'password',
        'role' => 'manager',
    ]);
    $firstManager = Manager::query()->create([
        'account_id' => $firstAccount->acc_id,
        'manager_name' => 'Activity One',
        'phone' => '',
        'manager_types' => ['Leads Manager'],
    ]);
    $secondManager = Manager::query()->create([
        'account_id' => $secondAccount->acc_id,
        'manager_name' => 'Activity Two',
        'phone' => '',
        'manager_types' => [],
    ]);
    $firstManager->permissions()->create([
        'module' => 'data',
        'access_level' => 'view',
    ]);
    $secondManager->permissions()->create([
        'module' => 'data',
        'access_level' => 'view',
    ]);
    $agent = Agent::query()->create(['agent_name' => 'Activity Agent']);
    $lead = Lead::query()->create([
        'customer_name' => 'Combined Activity Customer',
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000111',
        'address' => '111 Activity Street',
        'zip_code' => '90001',
        'city' => 'Los Angeles',
        'county' => '',
        'state' => 'CA',
        'years_in_house' => 0,
        'appointment_at' => now(),
        'telemarketer_notes' => '',
        'source' => 'Manual',
        'agent_id' => $agent->agent_id,
        'created_by' => $firstAccount->acc_id,
        'status' => 'dispatched',
    ]);

    foreach ([$firstAccount, $secondAccount] as $index => $account) {
        LeadMovement::query()->create([
            'lead_id' => $lead->id,
            'from_status' => $index === 0 ? 'confirmed' : 'dispatched',
            'to_status' => $index === 0 ? 'dispatched' : 'reschedule',
            'moved_by' => $account->acc_id,
        ]);
        RingCentralCall::query()->create([
            'lead_id' => $lead->id,
            'account_id' => $account->acc_id,
            'phone_number' => '+15550000111',
            'normalized_phone' => '+15550000111',
            'direction' => 'Outbound',
            'result' => 'Accepted',
            'duration_seconds' => 60 + $index,
            'initiated_at' => now()->addMinute($index),
        ]);
    }

    return compact(
        'firstAccount',
        'secondAccount',
        'firstManager',
        'secondManager',
        'lead',
    );
}

test('manager activity combines only the signed in manager calls and lead history by default', function () {
    ['firstAccount' => $firstAccount] = managerActivityFixtures();

    $this->actingAs($firstAccount)
        ->get(route('lead-workflow.call-logs'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/manager-activity')
            ->where('canViewAll', false)
            ->has('managers', 1)
            ->has('calls.data', 1)
            ->where('calls.data.0.account_id', $firstAccount->acc_id)
            ->has('activities.data', 0));
});

test('manager activity permission exposes every managers calls and lead history', function () {
    ['firstAccount' => $firstAccount, 'firstManager' => $firstManager] = managerActivityFixtures();
    $firstManager->permissions()->create([
        'module' => 'manager_history',
        'access_level' => 'view',
    ]);

    $this->actingAs($firstAccount)
        ->get(route('lead-workflow.call-logs'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/manager-activity')
            ->where('canViewAll', true)
            ->has('managers', 2)
            ->where('managers.0.manager_types', ['Leads Manager'])
            ->has('calls.data', 2)
            ->has('activities.data', 0));
});

test('view all manager activity can filter history by confirm and dispatch movements', function () {
    ['firstAccount' => $firstAccount, 'firstManager' => $firstManager, 'lead' => $lead] = managerActivityFixtures();
    $firstManager->permissions()->create([
        'module' => 'manager_history',
        'access_level' => 'view',
    ]);
    LeadMovement::query()->create([
        'lead_id' => $lead->id,
        'from_status' => 'fresh',
        'to_status' => 'confirmed',
        'moved_by' => $firstAccount->acc_id,
    ]);

    $this->actingAs($firstAccount)
        ->get(route('lead-workflow.call-logs', [
            'view' => 'history',
            'destination' => 'confirmed',
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.destination', 'confirmed')
            ->has('activities.data', 1)
            ->where('activities.data.0.description', 'Moved lead from fresh to confirmed.'));
});

test('manager without view all access cannot apply a destination filter', function () {
    ['firstAccount' => $firstAccount] = managerActivityFixtures();

    $this->actingAs($firstAccount)
        ->get(route('lead-workflow.call-logs', [
            'view' => 'history',
            'destination' => 'confirmed',
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('canViewAll', false)
            ->where('filters.destination', null)
            ->where('activities.total', 3));
});

test('manager activity loads lead history only when the history view is selected', function () {
    ['firstAccount' => $firstAccount] = managerActivityFixtures();

    $this->actingAs($firstAccount)
        ->get(route('lead-workflow.call-logs', ['view' => 'history']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.view', 'history')
            ->where('activities.data', fn ($activities): bool => collect($activities)->isNotEmpty()
                && collect($activities)->every(
                    fn (array $activity): bool => $activity['manager_account_id'] === $firstAccount->acc_id,
                )));
});

test('call searches do not execute or return the hidden manager history dataset', function () {
    ['firstAccount' => $firstAccount, 'firstManager' => $firstManager] = managerActivityFixtures();
    $firstManager->permissions()->create([
        'module' => 'manager_history',
        'access_level' => 'view',
    ]);

    $this->actingAs($firstAccount)
        ->get(route('lead-workflow.call-logs', [
            'view' => 'calls',
            'search' => 'nancy',
            'from' => '2026-08-01',
            'to' => '2026-08-06',
            'call_sort' => 'date',
            'call_direction' => 'desc',
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.view', 'calls')
            ->where('filters.search', 'nancy')
            ->has('activities.data', 0));
});

test('manager activity defaults to today and excludes inactive managers from its filter', function () {
    [
        'firstAccount' => $firstAccount,
        'firstManager' => $firstManager,
        'secondAccount' => $secondAccount,
    ] = managerActivityFixtures();
    $firstManager->permissions()->create([
        'module' => 'manager_history',
        'access_level' => 'view',
    ]);
    $secondAccount->update(['suspended_at' => now()]);
    $today = now('America/Los_Angeles')->toDateString();

    $this->actingAs($firstAccount)
        ->get(route('lead-workflow.call-logs'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('managers', 1)
            ->where('managers.0.account_id', $firstAccount->acc_id)
            ->where('filters.from', $today)
            ->where('filters.to', $today));
});

test('called leads can be filtered to conversations over twenty seconds and sorted', function () {
    [
        'firstAccount' => $firstAccount,
        'firstManager' => $firstManager,
        'secondAccount' => $secondAccount,
    ] = managerActivityFixtures();
    $firstManager->permissions()->create([
        'module' => 'manager_history',
        'access_level' => 'view',
    ]);
    RingCentralCall::query()->where('account_id', $firstAccount->acc_id)->update(['duration_seconds' => 20]);
    RingCentralCall::query()->where('account_id', $secondAccount->acc_id)->update(['duration_seconds' => 45]);

    $this->actingAs($firstAccount)
        ->get(route('lead-workflow.call-logs', [
            'talked_to' => 1,
            'call_sort' => 'duration',
            'call_direction' => 'asc',
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.talked_to', true)
            ->where('filters.call_sort', 'duration')
            ->where('filters.call_direction', 'asc')
            ->has('calls.data', 1)
            ->where('calls.data.0.account_id', $secondAccount->acc_id)
            ->where('calls.data.0.duration_seconds', 45));
});

test('call-only filters are cleared and do not affect lead history', function () {
    ['firstAccount' => $firstAccount] = managerActivityFixtures();

    $this->actingAs($firstAccount)
        ->get(route('lead-workflow.call-logs', [
            'view' => 'history',
            'talked_to' => 1,
            'call_sort' => 'duration',
            'call_direction' => 'asc',
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.view', 'history')
            ->where('filters.talked_to', false)
            ->where('activities.data', fn ($activities): bool => collect($activities)->isNotEmpty()));
});

test('manager activity header movement totals follow shared filters and ignore call-only filters', function () {
    ['firstAccount' => $firstAccount, 'lead' => $lead] = managerActivityFixtures();

    LeadMovement::query()->create([
        'lead_id' => $lead->id,
        'from_status' => 'rehash',
        'to_status' => 'fresh',
        'moved_by' => $firstAccount->acc_id,
    ]);
    LeadMovement::query()->create([
        'lead_id' => $lead->id,
        'from_status' => 'fresh',
        'to_status' => 'confirmed',
        'moved_by' => $firstAccount->acc_id,
    ]);
    LeadMovement::query()->create([
        'lead_id' => $lead->id,
        'from_status' => 'confirmed',
        'to_status' => 'dispatched',
        'moved_by' => $firstAccount->acc_id,
    ]);
    RingCentralCall::query()
        ->where('account_id', $firstAccount->acc_id)
        ->update(['duration_seconds' => 10]);

    $this->actingAs($firstAccount)
        ->get(route('lead-workflow.call-logs', [
            'view' => 'calls',
            'talked_to' => 1,
            'search' => 'Combined Activity Customer',
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('calls.total', 0)
            ->where('movementTotals.total', 1)
            ->where('movementTotals.confirmed', 1)
            ->where('movementTotals.dispatched', 1)
            ->where('movementTotals.sold', 0));
});
