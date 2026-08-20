<?php

use App\Models\Account;
use App\Models\Contractor;
use App\Models\Project;

test('admin can assign up to four distinct contractors to a project in position order', function () {
    $admin = Account::query()->create([
        'username' => 'project-contractors-admin',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $project = Project::query()->create([
        'status' => 'new',
        'amount' => 0,
        'created_by' => $admin->acc_id,
    ]);
    $contractors = collect(['One', 'Two', 'Three'])->map(fn (string $name) => Contractor::query()->create([
        'contractor' => "Contractor {$name}",
        'address' => '',
        'zip' => 0,
        'city' => '',
        'state' => '',
        'email' => '',
        'phone' => 0,
        'license' => 0,
    ]));

    $this->actingAs($admin)
        ->patch(route('management.projects.contractors.update', $project), [
            'contractor_ids' => [
                $contractors[0]->con_id,
                $contractors[1]->con_id,
                null,
                $contractors[2]->con_id,
            ],
        ])
        ->assertRedirect();

    expect($project->contractors()->pluck('contractors.con_id')->all())->toBe([
        $contractors[0]->con_id,
        $contractors[1]->con_id,
        $contractors[2]->con_id,
    ]);
    $this->assertDatabaseHas('project_contractor_assignments', [
        'project_id' => $project->id,
        'contractor_id' => $contractors[2]->con_id,
        'position' => 4,
    ]);
});
