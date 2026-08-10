<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Lead;
use App\Models\LeadMovement;
use App\Models\LeadNote;
use App\Models\Manager;
use App\Models\ManagerPermission;
use Inertia\Testing\AssertableInertia as Assert;

function createKeepInTouchLead(Account $creator, string $name, string $status, ?string $appointment): Lead
{
    $agent = Agent::query()->firstOrCreate(
        ['agent_name' => 'Keep In Touch Agent'],
        ['company_id' => null, 'phone_number' => null],
    );

    return Lead::query()->create([
        'customer_name' => $name,
        'marital_status' => 'Unknown',
        'primary_number' => '+15550000666',
        'status' => $status,
        'appointment_at' => $appointment,
        'agent_id' => $agent->agent_id,
        'created_by' => $creator->acc_id,
        'address' => '1 Follow Up Street',
        'city' => 'Los Angeles',
        'state' => 'CA',
        'zip_code' => '90001',
        'county' => '',
        'years_in_house' => 0,
        'telemarketer_notes' => '',
        'source' => 'Manual',
    ]);
}

function createLeadsManager(string $username, bool $canViewAll = false): array
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
        'module' => 'keep_in_touch',
        'access_level' => 'view',
    ]);
    ManagerPermission::query()->create([
        'manager_id' => $manager->manager_id,
        'module' => 'view_all_kit_managers',
        'access_level' => $canViewAll ? 'edit' : 'none',
    ]);

    return [$account, $manager];
}

function moveLeadToKeepInTouch(Lead $lead, Account $manager): void
{
    Lead::query()->whereKey($lead->id)->update(['status' => 'kit']);
    LeadMovement::query()->create([
        'lead_id' => $lead->id,
        'from_status' => 'fresh',
        'to_status' => 'kit',
        'moved_by' => $manager->acc_id,
    ]);
}

test('keep in touch defaults to the latest appointment date that has leads', function () {
    $admin = Account::query()->create([
        'username' => 'keep-in-touch-date-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);

    createKeepInTouchLead($admin, 'Earlier Follow Up', 'kit', '2026-07-12 10:00:00');
    createKeepInTouchLead($admin, 'Latest Follow Up', 'kit_cb', '2026-07-31 14:00:00');
    createKeepInTouchLead($admin, 'Unscheduled Follow Up', 'kit', null);

    $this->actingAs($admin)
        ->get(route('lead-workflow.keep-in-touch'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/keep-in-touch')
            ->where('selectedDate', '2026-07-31')
            ->where('dateField', 'appointment_at')
            ->has('dateRows', 3)
            ->has('leads', 1)
            ->where('leads.0.customer_name', 'Latest Follow Up'));
});

test('keep in touch queue total includes leads without appointment dates', function () {
    $admin = Account::query()->create([
        'username' => 'keep-in-touch-total-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);

    createKeepInTouchLead($admin, 'Scheduled KIT', 'kit', '2026-07-31 12:00:00');
    createKeepInTouchLead($admin, 'Unscheduled NG', 'kit_ng', null);
    createKeepInTouchLead($admin, 'Unscheduled Callback', 'kit_cb', null);

    $this->actingAs($admin)
        ->get(route('lead-workflow.keep-in-touch'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/keep-in-touch')
            ->where('queueTotal', 3)
            ->has('dateRows', 2)
            ->where('dateRows.1.key', 'unscheduled')
            ->where('dateRows.1.count', 2));
});

test('keep in touch can open leads without appointment dates', function () {
    $admin = Account::query()->create([
        'username' => 'keep-in-touch-unscheduled-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);

    createKeepInTouchLead($admin, 'Scheduled KIT', 'kit', '2026-07-31 12:00:00');
    createKeepInTouchLead($admin, 'Unscheduled KIT', 'kit', null);

    $this->actingAs($admin)
        ->get(route('lead-workflow.keep-in-touch', ['date' => 'unscheduled']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('selectedDate', 'unscheduled')
            ->has('leads', 1)
            ->where('leads.0.customer_name', 'Unscheduled KIT'));
});

test('sidebar search keeps an explicitly requested lead visible outside the active date bucket', function () {
    $admin = Account::query()->create([
        'username' => 'keep-in-touch-sidebar-search-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);

    createKeepInTouchLead($admin, 'Latest Scheduled KIT', 'kit', '2026-08-08 12:00:00');
    $requestedLead = createKeepInTouchLead($admin, 'Requested Unscheduled KIT', 'kit', null);

    $this->actingAs($admin)
        ->get(route('lead-workflow.keep-in-touch', [
            'lead' => $requestedLead->id,
            'focus' => 'search',
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('selectedDate', '2026-08-08')
            ->has('leads', 2)
            ->where('leads.0.id', $requestedLead->id));
});

test('expanded notes receive the complete saved history', function () {
    $admin = Account::query()->create([
        'username' => 'keep-in-touch-complete-note-history-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);

    $lead = createKeepInTouchLead(
        $admin,
        'Complete Note History Lead',
        'kit',
        '2026-08-08 12:00:00',
    );

    foreach (range(1, 30) as $number) {
        LeadNote::query()->create([
            'lead_id' => $lead->id,
            'note_type' => 'confirmation',
            'body' => "Confirmation note {$number}",
            'created_by' => $admin->acc_id,
        ]);
    }

    $this->actingAs($admin)
        ->get(route('lead-workflow.keep-in-touch', ['date' => '2026-08-08']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('leads', 1)
            ->has('leads.0.notes', 30));
});

test('keep in touch loads all matching subtypes for a selected appointment date', function () {
    $admin = Account::query()->create([
        'username' => 'keep-in-touch-subtypes-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);

    createKeepInTouchLead($admin, 'KIT Lead', 'kit', '2026-07-12 10:00:00');
    createKeepInTouchLead($admin, 'Callback Lead', 'kit_cb', '2026-07-12 12:00:00');
    createKeepInTouchLead($admin, 'Different Date', 'kit_ng', '2026-07-13 10:00:00');

    $this->actingAs($admin)
        ->get(route('lead-workflow.keep-in-touch', ['date' => '2026-07-12']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('selectedDate', '2026-07-12')
            ->has('leads', 2)
            ->where('leads.0.appointment_at', fn ($value) => str_starts_with($value, '2026-07-12'))
            ->where('leads.1.appointment_at', fn ($value) => str_starts_with($value, '2026-07-12')));
});

test('a leads manager only sees keep in touch leads they sent there', function () {
    [$firstAccount] = createLeadsManager('KIT Manager One');
    [$secondAccount] = createLeadsManager('KIT Manager Two');
    $creator = Account::query()->create(['username' => 'kit-owner-admin', 'password' => 'password', 'role' => 'admin']);

    $firstLead = createKeepInTouchLead($creator, 'First Manager Lead', 'fresh', '2026-08-07 10:00:00');
    $secondLead = createKeepInTouchLead($creator, 'Second Manager Lead', 'fresh', '2026-08-07 11:00:00');
    moveLeadToKeepInTouch($firstLead, $firstAccount);
    moveLeadToKeepInTouch($secondLead, $secondAccount);

    $this->actingAs($firstAccount)
        ->get(route('lead-workflow.keep-in-touch', ['date' => '2026-08-07']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('queueTotal', 1)
            ->where('selectedQueueManager', (string) $firstAccount->acc_id)
            ->where('canViewAllQueueManagers', false)
            ->has('queueManagers', 1)
            ->where('queueManagers.0.id', (string) $firstAccount->acc_id)
            ->has('leads', 1)
            ->where('leads.0.customer_name', 'First Manager Lead'));
});

test('a permitted leads manager can view and filter all managers keep in touch leads', function () {
    [$viewer] = createLeadsManager('KIT Manager Viewer', true);
    [$other] = createLeadsManager('KIT Manager Other');
    $creator = Account::query()->create(['username' => 'kit-filter-admin', 'password' => 'password', 'role' => 'admin']);

    $viewerLead = createKeepInTouchLead($creator, 'Viewer Lead', 'fresh', '2026-08-07 10:00:00');
    $otherLead = createKeepInTouchLead($creator, 'Other Lead', 'fresh', '2026-08-07 11:00:00');
    moveLeadToKeepInTouch($viewerLead, $viewer);
    moveLeadToKeepInTouch($otherLead, $other);

    $this->actingAs($viewer)
        ->get(route('lead-workflow.keep-in-touch', ['date' => '2026-08-07', 'manager' => $other->acc_id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('queueTotal', 1)
            ->where('selectedQueueManager', (string) $other->acc_id)
            ->where('canViewAllQueueManagers', true)
            ->has('queueManagers', 2)
            ->has('leads', 1)
            ->where('leads.0.customer_name', 'Other Lead'));
});

test('keep in touch manager filters exclude inactive managers', function () {
    [$viewer] = createLeadsManager('KIT Active Viewer', true);
    [$inactiveAccount] = createLeadsManager('KIT Inactive Manager');
    $inactiveAccount->update(['suspended_at' => now()]);

    $this->actingAs($viewer)
        ->get(route('lead-workflow.keep-in-touch'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('queueManagers', 1)
            ->where('queueManagers.0.id', (string) $viewer->acc_id)
            ->where('queueManagers.0.name', 'KIT Active Viewer'));
});
