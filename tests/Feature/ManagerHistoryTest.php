<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Lead;
use App\Models\LeadMovement;
use App\Models\Manager;
use Inertia\Testing\AssertableInertia as Assert;

function managerHistoryFixtures(): array
{
    $firstAccount = Account::query()->create(['username' => 'history-one@example.com', 'password' => 'password', 'role' => 'manager']);
    $secondAccount = Account::query()->create(['username' => 'history-two@example.com', 'password' => 'password', 'role' => 'manager']);
    $firstManager = Manager::query()->create(['account_id' => $firstAccount->acc_id, 'manager_name' => 'History One', 'phone' => '', 'manager_types' => []]);
    $secondManager = Manager::query()->create(['account_id' => $secondAccount->acc_id, 'manager_name' => 'History Two', 'phone' => '', 'manager_types' => []]);
    $agent = Agent::query()->create(['agent_name' => 'History Agent']);
    $lead = Lead::query()->create([
        'customer_name' => 'History Customer', 'marital_status' => 'Unknown',
        'primary_number' => '+15550000100', 'address' => '100 History Street',
        'zip_code' => '00000', 'city' => 'History City', 'county' => 'History County',
        'state' => 'CA', 'years_in_house' => 0, 'appointment_at' => now(),
        'telemarketer_notes' => '', 'source' => 'Manual', 'agent_id' => $agent->agent_id,
        'created_by' => $firstAccount->acc_id, 'status' => 'dispatched',
    ]);
    LeadMovement::query()->create(['lead_id' => $lead->id, 'from_status' => 'confirmed', 'to_status' => 'dispatched', 'moved_by' => $firstAccount->acc_id]);
    LeadMovement::query()->create(['lead_id' => $lead->id, 'from_status' => 'dispatched', 'to_status' => 'reschedule', 'moved_by' => $secondAccount->acc_id]);

    return compact('firstAccount', 'secondAccount', 'firstManager', 'secondManager');
}

test('manager activity without permission is restricted to the signed in manager', function () {
    ['firstAccount' => $firstAccount] = managerHistoryFixtures();

    $this->actingAs($firstAccount)
        ->get(route('lead-workflow.call-logs'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/manager-activity')
            ->where('canViewAll', false)
            ->has('managers', 1)
            ->where('activities.data', fn ($activities): bool => collect($activities)->isNotEmpty()
                && collect($activities)->every(fn (array $activity): bool => $activity['manager_account_id'] === $firstAccount->acc_id)));
});

test('manager activity permission allows viewing every manager', function () {
    ['firstAccount' => $firstAccount, 'firstManager' => $firstManager] = managerHistoryFixtures();
    $firstManager->permissions()->create(['module' => 'manager_history', 'access_level' => 'view']);

    $this->actingAs($firstAccount)
        ->get(route('lead-workflow.call-logs'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/manager-activity')
            ->where('canViewAll', true)
            ->has('managers', 2)
            ->where('activities.data', fn ($activities): bool => collect($activities)->pluck('manager_name')->unique()->count() === 2));
});

test('non manager accounts are redirected away from manager activity', function () {
    $agentAccount = Account::query()->create(['username' => 'history-agent@example.com', 'password' => 'password', 'role' => 'agent']);

    $this->actingAs($agentAccount)
        ->get(route('lead-workflow.call-logs'))
        ->assertRedirect(route('agent.dashboard'));
});

test('the former manager history route redirects to manager activity', function () {
    ['firstAccount' => $firstAccount] = managerHistoryFixtures();

    $this->actingAs($firstAccount)
        ->get(route('management.manager-history'))
        ->assertRedirect('/lead-workflow/call-logs');
});
