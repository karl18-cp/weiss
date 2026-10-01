<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Company;
use App\Models\Lead;
use App\Models\Manager;
use App\Models\Product;
use App\Models\Project;
use Inertia\Testing\AssertableInertia as Assert;

function companyAccessLead(int $companyId, Account $creator, Agent $agent, Product $product, string $name): Lead
{
    return Lead::query()->create([
        'customer_name' => $name,
        'marital_status' => 'Unknown',
        'primary_number' => '+15550001000',
        'address' => '100 Test Street',
        'zip_code' => '90001',
        'city' => 'Los Angeles',
        'county' => 'Los Angeles',
        'state' => 'CA',
        'years_in_house' => 1,
        'product_id' => $product->prod_id,
        'appointment_at' => now(),
        'telemarketer_notes' => '',
        'company_id' => $companyId,
        'source' => 'Manual',
        'agent_id' => $agent->agent_id,
        'created_by' => $creator->acc_id,
        'status' => 'fresh',
    ]);
}

test('manager data is restricted to assigned companies across leads projects and company options', function () {
    $sbh = Company::query()->create([
        'com_id' => 101,
        'company' => 'SBH Construction',
        'address' => '',
        'prefix' => 'SBH',
        'project_code' => 'SBH',
    ]);
    $other = Company::query()->create([
        'com_id' => 102,
        'company' => 'Other Company',
        'address' => '',
        'prefix' => 'OTH',
        'project_code' => 'OTH',
    ]);
    $admin = Account::query()->create([
        'username' => 'company-scope-admin@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $account = Account::query()->create([
        'username' => 'sbh-manager@example.com',
        'password' => 'password',
        'role' => 'manager',
    ]);
    $manager = Manager::query()->create([
        'account_id' => $account->acc_id,
        'manager_name' => 'SBH Manager',
        'phone' => '',
        'company_id' => $sbh->com_id,
        'manager_types' => ['Leads Manager', 'Project Manager'],
    ]);
    $manager->companies()->sync([$sbh->com_id]);
    foreach (['leads_shop', 'lead_card', 'projects'] as $module) {
        $manager->permissions()->create(['module' => $module, 'access_level' => 'edit']);
    }

    $agent = Agent::query()->create(['agent_name' => 'Company Scope Agent']);
    $product = Product::query()->create(['product_name' => 'Company Scope Product']);
    $sbhLead = companyAccessLead($sbh->com_id, $admin, $agent, $product, 'SBH Customer');
    $otherLead = companyAccessLead($other->com_id, $admin, $agent, $product, 'Other Customer');
    $sbhProject = Project::query()->create([
        'lead_id' => $sbhLead->id,
        'amount' => 1000,
        'status' => 'new',
        'created_by' => $admin->acc_id,
    ]);
    $otherProject = Project::query()->create([
        'lead_id' => $otherLead->id,
        'amount' => 2000,
        'status' => 'new',
        'created_by' => $admin->acc_id,
    ]);

    $this->actingAs($account);

    expect(Company::query()->pluck('com_id')->all())->toBe([$sbh->com_id])
        ->and(Lead::query()->pluck('id')->all())->toBe([$sbhLead->id])
        ->and(Project::query()->pluck('id')->all())->toBe([$sbhProject->id]);

    $this->get(route('lead-search', ['q' => 'Customer']))
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $sbhLead->id);
    $this->get(route('management.projects'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('projects', 1)
            ->where('projects.0.id', $sbhProject->id)
            ->has('companies', 1)
            ->where('companies.0.com_id', $sbh->com_id)
            ->where('workflowCounts.leads_shop', 1));

    $this->patch(route('lead-workflow.leads-shop.status.update', $otherLead), ['status' => 'confirmed'])
        ->assertNotFound();
    $this->get(route('management.projects.cover-page', $otherProject))
        ->assertNotFound();
    $this->post(route('lead-workflow.lead-card.store'), ['company_id' => $other->com_id])
        ->assertForbidden();

    $this->actingAs($admin);
    expect(Company::query()->count())->toBe(2)
        ->and(Lead::query()->count())->toBe(2)
        ->and(Project::query()->count())->toBe(2);
});
