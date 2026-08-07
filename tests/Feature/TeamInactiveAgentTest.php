<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Manager;
use App\Models\Team;
use Inertia\Testing\AssertableInertia as Assert;

test('teams tab excludes inactive agents from available and existing team members', function () {
    $admin = Account::query()->create([
        'username' => 'teams-inactive-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $manager = Manager::query()->create([
        'manager_name' => 'Teams Manager',
        'account_id' => $admin->acc_id,
        'phone' => '',
        'manager_types' => [],
    ]);
    $activeAgent = Agent::query()->create(['agent_name' => 'Active Team Agent']);
    $inactiveAgent = Agent::query()->create([
        'agent_name' => 'Inactive Team Agent',
        'inactive_at' => now(),
    ]);
    $team = Team::query()->create([
        'team_name' => 'Active Members Only',
        'manager_id' => $manager->manager_id,
    ]);
    $team->agents()->attach([$activeAgent->agent_id, $inactiveAgent->agent_id]);

    $this->actingAs($admin)
        ->get(route('management.teams'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('management/teams')
            ->has('agents', 1)
            ->where('agents.0.agent_id', $activeAgent->agent_id)
            ->has('teams.0.agents', 1)
            ->where('teams.0.agents.0.agent_id', $activeAgent->agent_id));
});

test('inactive agents cannot be submitted as team members', function () {
    $admin = Account::query()->create([
        'username' => 'teams-inactive-validation-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $manager = Manager::query()->create([
        'manager_name' => 'Validation Manager',
        'account_id' => $admin->acc_id,
        'phone' => '',
        'manager_types' => [],
    ]);
    $inactiveAgent = Agent::query()->create([
        'agent_name' => 'Rejected Inactive Agent',
        'inactive_at' => now(),
    ]);

    $this->actingAs($admin)
        ->post(route('management.teams.store'), [
            'team_name' => 'Invalid Inactive Team',
            'manager_id' => $manager->manager_id,
            'agent_ids' => [$inactiveAgent->agent_id],
        ])
        ->assertSessionHasErrors('agent_ids.0');

    $this->assertDatabaseMissing('teams', ['team_name' => 'Invalid Inactive Team']);
});
