<?php

use App\Models\Account;
use App\Models\Agent;
use App\Models\Company;
use App\Models\Contractor;
use App\Models\Lead;
use App\Models\Product;
use App\Models\Project;
use App\Models\ProjectAccountingTransaction;
use App\Models\ProjectDocument;
use App\Models\ProjectInvoice;
use App\Models\Salesman;
use App\Models\Vendor;
use App\Services\GoogleDriveProjectStorage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

test('a project cover page renders as an inline pdf from project totals', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);

    $this->actingAs($account)
        ->post(route('lead-workflow.leads-shop.sale', $lead), ['amount' => 10000]);

    $project = $lead->refresh()->project()->firstOrFail();
    ProjectAccountingTransaction::query()->create([
        'project_id' => $project->id,
        'type' => 'receivable',
        'category' => 'Customer payment',
        'transaction_date' => now(),
        'amount' => 7500,
        'status' => 'pending',
    ]);
    ProjectAccountingTransaction::query()->create([
        'project_id' => $project->id,
        'type' => 'payable',
        'category' => 'Commission',
        'transaction_date' => now(),
        'amount' => 1000,
        'status' => 'pending',
    ]);

    $response = $this->get(route('management.projects.cover-page', $project));

    $response->assertOk()
        ->assertHeader('content-type', 'application/pdf')
        ->assertHeader(
            'content-disposition',
            'attachment; filename="'.preg_replace('/[^A-Za-z0-9._-]+/', '-', $project->project_number).'-cover-page.pdf"',
        );
    expect($response->getContent())->toStartWith('%PDF');
});

test('project accounting downloads separate payables and receivables pdfs', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);
    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), ['amount' => 10000]);
    $project = $lead->refresh()->project()->firstOrFail();

    foreach ([
        ['type' => 'payable', 'category' => 'Commission payment', 'amount' => 1250, 'counterparty' => 'Sales Rep One'],
        ['type' => 'receivable', 'category' => 'Customer deposit', 'amount' => 6000, 'counterparty' => 'Project Customer'],
    ] as $transaction) {
        ProjectAccountingTransaction::query()->create([
            'project_id' => $project->id,
            'transaction_date' => now(),
            'status' => 'pending',
            ...$transaction,
        ]);
    }

    foreach (['payable' => 'payables', 'receivable' => 'receivables'] as $type => $label) {
        $response = $this->get(route('management.projects.accounting.export', [$project, $type]));
        $response->assertOk()
            ->assertHeader('content-type', 'application/pdf')
            ->assertHeader(
                'content-disposition',
                'attachment; filename="'.preg_replace('/[^A-Za-z0-9._-]+/', '-', $project->project_number).'-'.$label.'.pdf"',
            );
        expect($response->getContent())->toStartWith('%PDF');
    }
});

test('a sale attachment can be removed without deleting its sale', function () {
    Storage::fake('local');
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);

    $this->actingAs($account)
        ->post(route('lead-workflow.leads-shop.sale', $lead), ['amount' => 10000]);

    $project = $lead->refresh()->project()->firstOrFail();
    $sale = $project->sales()->firstOrFail();
    $path = "project-documents/{$project->id}/contract.pdf";
    Storage::disk('local')->put($path, 'contract contents');
    $document = ProjectDocument::query()->create([
        'project_id' => $project->id,
        'project_sale_id' => $sale->id,
        'uploaded_by' => $account->acc_id,
        'category' => 'Sale Contract',
        'file_path' => $path,
        'file_name' => 'contract.pdf',
        'file_mime' => 'application/pdf',
        'file_size' => 17,
    ]);

    $this->delete(route('management.projects.documents.destroy', [$project, $document]))
        ->assertRedirect();

    $this->assertDatabaseMissing('project_documents', ['id' => $document->id]);
    $this->assertDatabaseHas('project_sales', ['id' => $sale->id]);
    Storage::disk('local')->assertMissing($path);
});

function projectSaleFixtures(): array
{
    $account = Account::query()->create([
        'username' => 'project-sale-admin@example.com',
        'password' => 'password',
        'role' => 'admin',
    ]);
    $company = Company::query()->create([
        'com_id' => 1,
        'company' => 'Project Company',
        'address' => '',
        'prefix' => 'PC',
        'project_code' => 'PC-001',
    ]);
    $product = Product::query()->create(['product_name' => 'Windows']);
    $agent = Agent::query()->create(['agent_name' => 'Project Agent']);
    $salesman = Salesman::query()->create(['salesman_name' => 'Project Salesman']);
    $lead = Lead::query()->create([
        'customer_name' => 'Project Customer',
        'marital_status' => 'Single',
        'primary_number' => '555-1000',
        'mobile_number' => '555-2000',
        'address' => '100 Project Way',
        'zip_code' => '90001',
        'city' => 'Los Angeles',
        'county' => 'Los Angeles',
        'state' => 'CA',
        'years_in_house' => 4,
        'product_id' => $product->prod_id,
        'appointment_at' => now()->addDay(),
        'telemarketer_notes' => 'Project note',
        'company_id' => $company->com_id,
        'source' => 'CallTools',
        'agent_id' => $agent->agent_id,
        'created_by' => $account->acc_id,
        'status' => 'dispatched',
    ]);

    return compact('account', 'lead', 'salesman');
}

test('a sale requires an assigned salesman', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);

    $this->actingAs($account)
        ->post(route('lead-workflow.leads-shop.sale', $lead), [
            'amount' => 12500,
        ])
        ->assertSessionHasErrors('salesman');

    $this->assertDatabaseMissing('projects', ['lead_id' => $lead->id]);
    expect($lead->refresh()->status)->toBe('dispatched');
});

test('assigning a salesman is recorded in lead history', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();

    $this->actingAs($account)
        ->patch(route('lead-workflow.leads-shop.salesmen.update', $lead), [
            'salesman_1_id' => $salesman->salesman_id,
            'salesman_2_id' => null,
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('lead_notes', [
        'lead_id' => $lead->id,
        'note_type' => 'salesman_sent',
        'body' => "Salesman Sent: {$salesman->salesman_name} (Salesman 1).",
        'created_by' => $account->acc_id,
    ]);
});

test('project details can update the company and product', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);
    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), ['amount' => 12500]);

    $project = $lead->project()->firstOrFail();
    $company = Company::query()->create([
        'com_id' => 2,
        'company' => 'Replacement Company',
        'address' => '',
        'prefix' => 'RC',
        'project_code' => 'RC-100',
    ]);
    $product = Product::query()->create(['product_name' => 'Replacement Product']);
    $secondAgent = Agent::query()->create(['agent_name' => 'Second Project Agent']);
    $secondSalesman = Salesman::query()->create(['salesman_name' => 'Second Project Salesman']);

    $this->actingAs($account)
        ->put(route('management.projects.update', $project), [
            'project_number' => $project->project_number,
            'status' => 'progress',
            'company_id' => $company->com_id,
            'product_id' => $product->prod_id,
            'customer_name' => 'Updated Customer',
            'primary_number' => '+1 (408) 555-0110',
            'secondary_number' => '+1 (408) 555-0111',
            'mobile_number' => '+1 (408) 555-0112',
            'email' => 'updated@example.com',
            'address' => '99 Updated Street',
            'city' => 'Oakland',
            'state' => 'CA',
            'zip_code' => '94601',
            'source' => 'Updated Source',
            'appointment_at' => '2026-08-12 14:30:00',
            'lead_created_at' => '2026-08-01 09:15:00',
            'agent_id' => $lead->agent_id,
            'agent_2_id' => $secondAgent->agent_id,
            'salesman_1_id' => $salesman->salesman_id,
            'salesman_2_id' => $secondSalesman->salesman_id,
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect($lead->refresh()->company_id)->toBe($company->com_id)
        ->and($lead->product_id)->toBe($product->prod_id)
        ->and($lead->customer_name)->toBe('Updated Customer')
        ->and($lead->created_at->format('Y-m-d H:i'))->toBe('2026-08-01 09:15')
        ->and($lead->agent_2_id)->toBe($secondAgent->agent_id)
        ->and($lead->salesman_1_id)->toBe($salesman->salesman_id)
        ->and($lead->salesman_2_id)->toBe($secondSalesman->salesman_id)
        ->and($project->refresh()->status)->toBe('new')
        ->and($project->project_number)->toBe('RC#100')
        ->and($company->refresh()->project_code)->toBe('RC#101')
        ->and($project->sales()->where('type', 'original')->firstOrFail()->product_id)->toBe($product->prod_id);
});

test('project details can save an imported project with incomplete legacy fields', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);
    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), ['amount' => 12500]);
    $project = $lead->project()->firstOrFail();

    $lead->update([
        'company_id' => null,
        'product_id' => null,
        'primary_number' => '',
        'address' => '',
        'city' => '',
        'state' => '',
        'zip_code' => '',
        'source' => '',
    ]);

    $this->actingAs($account)
        ->put(route('management.projects.update', $project), [
            'project_number' => $project->project_number,
            'status' => 'new',
            'company_id' => null,
            'product_id' => null,
            'customer_name' => 'Saved Legacy Customer',
            'primary_number' => null,
            'secondary_number' => null,
            'mobile_number' => null,
            'email' => null,
            'address' => null,
            'city' => null,
            'state' => null,
            'zip_code' => null,
            'source' => null,
            'appointment_at' => null,
            'lead_created_at' => '2026-08-01 09:15:00',
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect($lead->refresh()->customer_name)->toBe('Saved Legacy Customer');
});

test('project overview preserves a decimal project number suffix', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);
    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), ['amount' => 12500]);
    $project = $lead->refresh()->project;

    $this->put(route('management.projects.update', $project), [
        'project_number' => 'PC#5071.1',
        'status' => 'progress',
        'company_id' => $lead->company_id,
        'product_id' => $lead->product_id,
        'customer_name' => $lead->customer_name,
        'primary_number' => $lead->primary_number,
        'secondary_number' => $lead->secondary_number,
        'mobile_number' => $lead->mobile_number,
        'email' => $lead->email,
        'address' => $lead->address,
        'city' => $lead->city,
        'state' => $lead->state,
        'zip_code' => $lead->zip_code,
        'source' => $lead->source,
        'appointment_at' => $lead->appointment_at,
        'lead_created_at' => $lead->created_at,
        'agent_id' => $lead->agent_id,
        'agent_2_id' => $lead->agent_2_id,
        'salesman_1_id' => $lead->salesman_1_id,
        'salesman_2_id' => $lead->salesman_2_id,
    ])->assertRedirect()->assertSessionHasNoErrors();

    expect($project->refresh()->project_number)->toBe('PC#5071.1');
});

test('an authenticated user can create a project directly from projects', function () {
    ['account' => $account, 'lead' => $fixtureLead] = projectSaleFixtures();
    $company = $fixtureLead->company;
    $product = $fixtureLead->product;
    $agent = $fixtureLead->agent;

    $leadCount = Lead::query()->count();

    $this->actingAs($account)
        ->post(route('management.projects.store'), [
            'customer_name' => 'Direct Project Customer',
            'contact_name' => 'Direct Contact',
            'primary_number' => '+1 (408) 555-0199',
            'mobile_number' => '+1 (408) 555-0188',
            'email' => 'direct-project@example.com',
            'address' => '500 Direct Avenue',
            'city' => 'San Jose',
            'state' => 'CA',
            'zip_code' => '95113',
            'company_id' => $company->com_id,
            'product_id' => $product->prod_id,
            'telemarketer_id' => $agent->agent_id,
            'salesman_id' => null,
            'manager_id' => null,
            'project_number' => '',
            'status' => 'new',
            'amount' => 25000,
            'budget' => 18000,
            'notes' => 'Standalone project notes.',
            'signed_date' => '2026-08-06',
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $project = Project::query()
        ->where('customer_name', 'Direct Project Customer')
        ->firstOrFail();

    expect(Lead::query()->count())->toBe($leadCount)
        ->and($project->lead_id)->toBeNull()
        ->and($project->contact_name)->toBe('Direct Contact')
        ->and($project->project_number)->toBe('PC#001')
        ->and($project->amount)->toBe('25000.00')
        ->and($project->budget)->toBe('18000.00')
        ->and($project->manual_notes)->toBe('Standalone project notes.')
        ->and($project->created_at->toDateString())->toBe('2026-08-06')
        ->and($project->sales()->where('type', 'original')->firstOrFail()->amount)->toBe('25000.00');

    expect($company->refresh()->project_code)->toBe('PC#002');
});

test('a customer can have multiple independently managed projects', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $firstSalesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $firstSalesman->salesman_id]);
    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), ['amount' => 12500]);

    $firstProject = $lead->project()->firstOrFail();
    $secondProduct = Product::query()->create(['product_name' => 'Roofing']);
    $secondSalesman = Salesman::query()->create(['salesman_name' => 'Second Job Salesman']);

    $this->post(route('management.projects.customer-projects.store', $firstProject), [
        'company_id' => $lead->company_id,
        'product_id' => $secondProduct->prod_id,
        'appointment_at' => '2026-09-12 14:30:00',
        'salesman_1_id' => $secondSalesman->salesman_id,
        'salesman_2_id' => null,
        'amount' => 18000,
        'notes' => '',
    ])->assertRedirect()->assertSessionHasNoErrors();

    $secondProject = Project::query()->where('project_number', 'PC#001.1')->firstOrFail();
    $secondLead = $secondProject->lead()->firstOrFail();

    $secondProject->invoices()->create([
        'invoice_number' => 'INV#SECOND-PROJECT',
        'invoice_date' => '2026-09-13',
        'amount' => 4200,
        'status' => 'pending',
    ]);
    foreach ([
        ['type' => 'receivable', 'category' => 'Customer Payment', 'amount' => 5000, 'status' => 'deposit'],
        ['type' => 'payable', 'category' => 'Vendor Payment', 'amount' => 1800, 'status' => 'pending'],
        ['type' => 'payable', 'category' => 'Commission (Default)', 'amount' => 600, 'status' => 'pending', 'salesman_id' => $secondSalesman->salesman_id],
    ] as $transaction) {
        $secondProject->accountingTransactions()->create([
            ...$transaction,
            'transaction_date' => '2026-09-13',
        ]);
    }

    expect($secondLead->id)->not->toBe($lead->id)
        ->and($secondLead->project_family_id)->toBe($lead->id)
        ->and($secondLead->customer_name)->toBe($lead->customer_name)
        ->and($secondLead->primary_number)->toBe($lead->primary_number)
        ->and($secondLead->appointment_at->format('Y-m-d H:i'))->toBe('2026-09-12 14:30')
        ->and($secondLead->product_id)->toBe($secondProduct->prod_id)
        ->and($secondLead->salesman_1_id)->toBe($secondSalesman->salesman_id)
        ->and($secondLead->telemarketer_notes)->toBe('')
        ->and($secondProject->amount)->toBe('18000.00')
        ->and($secondProject->accountingTransactions()->where('type', 'receivable')->count())->toBe(1)
        ->and($secondProject->accountingTransactions()->where('type', 'payable')->where('category', 'Vendor Payment')->count())->toBe(1)
        ->and($secondProject->accountingTransactions()->where('type', 'payable')->where('category', 'like', '%Commission%')->count())->toBe(1)
        ->and($secondProject->invoices()->count())->toBe(1)
        ->and($secondProject->sales()->firstOrFail()->amount)->toBe('18000.00')
        ->and($firstProject->refresh()->amount)->toBe('12500.00')
        ->and($firstProject->invoices()->count())->toBe(0)
        ->and($firstProject->accountingTransactions()->count())->toBe(0);
});

test('additional customer projects auto increment and can be deleted independently', function () {
    Storage::fake('local');
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);
    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), ['amount' => 10000]);
    $rootProject = $lead->project()->firstOrFail();

    $payload = [
        'company_id' => $lead->company_id,
        'product_id' => $lead->product_id,
        'appointment_at' => '2026-09-15 10:00:00',
        'salesman_1_id' => $salesman->salesman_id,
        'salesman_2_id' => null,
        'amount' => 5000,
        'notes' => '',
    ];
    $this->post(route('management.projects.customer-projects.store', $rootProject), $payload)
        ->assertRedirect()
        ->assertSessionHasNoErrors();
    $firstChild = Project::query()->where('project_number', 'PC#001.1')->firstOrFail();

    $this->post(route('management.projects.customer-projects.store', $firstChild), $payload)
        ->assertRedirect()
        ->assertSessionHasNoErrors();
    $secondChild = Project::query()->where('project_number', 'PC#001.2')->firstOrFail();

    $path = "project-documents/{$firstChild->id}/child-contract.pdf";
    Storage::disk('local')->put($path, 'child contract');
    $firstChild->documents()->create([
        'project_sale_id' => $firstChild->sales()->firstOrFail()->id,
        'uploaded_by' => $account->acc_id,
        'category' => 'Sale Contract',
        'file_path' => $path,
        'file_name' => 'child-contract.pdf',
        'file_mime' => 'application/pdf',
        'file_size' => 14,
    ]);
    $deletedLeadId = $firstChild->lead_id;

    $this->delete(route('management.projects.destroy', $rootProject))->assertStatus(422);
    $this->assertDatabaseHas('projects', ['id' => $rootProject->id]);

    $this->delete(route('management.projects.destroy', $firstChild))->assertRedirect(route('management.projects'));
    $this->assertDatabaseMissing('projects', ['id' => $firstChild->id]);
    $this->assertDatabaseMissing('leads', ['id' => $deletedLeadId]);
    $this->assertDatabaseHas('projects', ['id' => $rootProject->id]);
    $this->assertDatabaseHas('projects', ['id' => $secondChild->id]);
    Storage::disk('local')->assertMissing($path);
});

test('changing an appointment records the previous and new dates in lead history', function () {
    ['account' => $account, 'lead' => $lead] = projectSaleFixtures();
    $previousAppointment = $lead->appointment_at->copy();
    $nextAppointment = $previousAppointment->copy()->addDays(3)->setTime(14, 30);

    $this->actingAs($account)
        ->patch(route('lead-workflow.leads-shop.appointment.update', $lead), [
            'appointment_at' => $nextAppointment->format('Y-m-d H:i:s'),
        ])
        ->assertRedirect();

    $history = $lead->notes()
        ->where('note_type', 'appointment_date_change')
        ->latest()
        ->firstOrFail();

    expect($history->created_by)->toBe($account->acc_id)
        ->and($history->body)->toContain('Appointment changed from')
        ->and($history->body)->toContain(' to ')
        ->and($lead->refresh()->appointment_at->timestamp)->toBe($nextAppointment->timestamp);
});

test('accepting a sale creates a related project', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);

    $response = $this->actingAs($account)
        ->post(route('lead-workflow.leads-shop.sale', $lead), [
            'amount' => 12500.50,
        ]);

    $this->assertDatabaseHas('projects', [
        'lead_id' => $lead->id,
        'project_number' => null,
        'amount' => 12500.50,
        'status' => 'new',
        'created_by' => $account->acc_id,
    ]);
    expect($lead->refresh())
        ->status->toBe('project')
        ->appointment_result->toBe('Sold')
        ->project->not->toBeNull();
    $response->assertRedirect(route('management.projects', [
        'project' => $lead->project->id,
    ]));
    $this->assertDatabaseHas('project_sales', [
        'project_id' => $lead->project->id,
        'type' => 'original',
        'amount' => 12500.50,
    ]);
    expect($lead->company->refresh()->project_code)->toBe('PC-001');

    $this->actingAs($account)
        ->get(route('management.projects'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('management/projects')
            ->has('projects', 1)
            ->where('projects.0.lead_id', $lead->id)
            ->where('projects.0.status', 'new')
            ->where('projects.0.lead.company.prefix', 'PC')
            ->where('projects.0.lead.customer_name', 'Project Customer'),
        );
});

test('newly accepted sales remain unnumbered until work starts', function () {
    ['account' => $account, 'lead' => $firstLead, 'salesman' => $salesman] = projectSaleFixtures();
    $firstLead->update(['salesman_1_id' => $salesman->salesman_id]);
    $secondLead = $firstLead->replicate();
    $secondLead->customer_name = 'Second Project Customer';
    $secondLead->save();

    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $firstLead), [
        'amount' => 12500,
    ])->assertRedirect();
    $this->post(route('lead-workflow.leads-shop.sale', $secondLead), [
        'amount' => 15000,
    ])->assertRedirect();

    expect($firstLead->refresh()->project->project_number)->toBeNull()
        ->and($secondLead->refresh()->project->project_number)->toBeNull()
        ->and($firstLead->company->refresh()->project_code)->toBe('PC-001');
});

test('a dispatched sale can become a new project without company or product details', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update([
        'salesman_1_id' => $salesman->salesman_id,
        'company_id' => null,
        'product_id' => null,
    ]);

    $this->actingAs($account)
        ->post(route('lead-workflow.leads-shop.sale', $lead), ['amount' => 7500])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $this->assertDatabaseHas('projects', [
        'lead_id' => $lead->id,
        'project_number' => null,
        'status' => 'new',
        'amount' => 7500,
    ]);
    expect($lead->refresh()->status)->toBe('project');
});

test('duplicate project numbers show a clear validation error', function () {
    ['account' => $account, 'lead' => $lead] = projectSaleFixtures();

    Project::query()->create([
        'lead_id' => $lead->id,
        'project_number' => 'PC-777',
        'amount' => 1000,
        'status' => 'progress',
        'created_by' => $account->acc_id,
    ]);

    $this->actingAs($account)
        ->post(route('management.projects.store'), [
            'customer_name' => 'Duplicate Number Customer',
            'primary_number' => '+1 (408) 555-0100',
            'address' => '700 Duplicate Street',
            'city' => 'San Jose',
            'state' => 'CA',
            'zip_code' => '95113',
            'company_id' => $lead->company_id,
            'product_id' => $lead->product_id,
            'project_number' => 'PC-777',
            'status' => 'progress',
            'amount' => 1000,
            'signed_date' => '2026-08-06',
        ])
        ->assertSessionHasErrors([
            'project_number' => 'This project number already exists.',
        ]);
});

test('sold appointment results must use the sale workflow', function () {
    ['account' => $account, 'lead' => $lead] = projectSaleFixtures();

    $this->actingAs($account)
        ->patch(route('lead-workflow.leads-shop.appointment-result.update', $lead), [
            'appointment_result' => 'Sold',
        ])
        ->assertSessionHasErrors('appointment_result');

    expect($lead->refresh()->appointment_result)->not->toBe('Sold');
    $this->assertDatabaseMissing('projects', ['lead_id' => $lead->id]);
});

test('project referral sales can be added edited and deleted', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);

    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), [
        'amount' => 12500,
    ]);

    $project = $lead->refresh()->project;
    $product = $lead->product;

    $this->post(route('management.projects.sales.store', $project), [
        'amount' => 2500,
        'sale_date' => '2026-07-16',
        'product_id' => $product->prod_id,
    ])->assertRedirect();

    $referral = $project->sales()->where('type', 'referral')->firstOrFail();
    $this->assertDatabaseHas('project_sales', [
        'id' => $referral->id,
        'amount' => 2500,
        'type' => 'referral',
    ]);

    $this->put(route('management.projects.sales.update', [$project, $referral]), [
        'amount' => 3000,
        'sale_date' => '2026-07-17',
        'product_id' => $product->prod_id,
    ])->assertRedirect();

    expect($referral->refresh())
        ->amount->toBe('3000.00')
        ->sale_date->toDateString()->toBe('2026-07-17');

    $this->delete(route('management.projects.sales.destroy', [$project, $referral]))
        ->assertRedirect();
    $this->assertDatabaseMissing('project_sales', ['id' => $referral->id]);
});

test('a negative referral sale is stored as a project discount', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);

    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), [
        'amount' => 12500,
    ]);

    $project = $lead->refresh()->project;

    $this->post(route('management.projects.sales.store', $project), [
        'amount' => -1500,
        'sale_date' => '2026-07-16',
        'product_id' => $lead->product_id,
    ])->assertRedirect()->assertSessionHasNoErrors();

    $this->assertDatabaseHas('project_sales', [
        'project_id' => $project->id,
        'type' => 'referral',
        'amount' => -1500,
    ]);

    expect((float) $project->sales()->sum('amount'))->toBe(11000.0);
});

test('new referral amounts for the same salesman remain separate sales', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $originalSalesman] = projectSaleFixtures();
    $referralSalesman = Salesman::query()->create(['salesman_name' => 'Repeat Referral Salesman']);
    $lead->update([
        'salesman_1_id' => $originalSalesman->salesman_id,
        'salesman_2_id' => $referralSalesman->salesman_id,
    ]);

    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), [
        'amount' => 12500,
    ]);

    $project = $lead->refresh()->project;
    foreach ([2500, 1750, -500] as $amount) {
        $this->post(route('management.projects.sales.store', $project), [
            'amount' => $amount,
            'sale_date' => '2026-07-16',
            'product_id' => $lead->product_id,
            'salesman_id' => $referralSalesman->salesman_id,
        ])->assertRedirect()->assertSessionHasNoErrors();
    }

    $referrals = $project->sales()
        ->where('type', 'referral')
        ->where('salesman_id', $referralSalesman->salesman_id)
        ->get();

    expect($referrals)->toHaveCount(3)
        ->and($referrals->pluck('amount')->all())->toBe(['2500.00', '1750.00', '-500.00']);
});

test('a referral sale can create a separate project with isolated accounting', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $originalSalesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $originalSalesman->salesman_id]);
    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), ['amount' => 12500]);

    $originalProject = $lead->project()->firstOrFail();
    $referralSalesman = Salesman::query()->create(['salesman_name' => 'Referral Project Salesman']);

    $this->post(route('management.projects.sales.store', $originalProject), [
        'amount' => 5000,
        'sale_date' => '2026-09-08',
        'product_id' => $lead->product_id,
        'salesman_id' => $referralSalesman->salesman_id,
        'destination' => 'new_project',
        'project_number' => 'PC#001.1',
    ])->assertRedirect()->assertSessionHasNoErrors();

    $referralProject = Project::query()->where('project_number', 'PC#001.1')->firstOrFail();
    $referralLead = $referralProject->lead()->firstOrFail();

    expect($referralProject->id)->not->toBe($originalProject->id)
        ->and($referralLead->project_family_id)->toBe($lead->id)
        ->and($referralLead->salesman_1_id)->toBe($originalSalesman->salesman_id)
        ->and($referralLead->salesman_2_id)->toBe($referralSalesman->salesman_id)
        ->and($referralProject->sales()->where('type', 'original')->count())->toBe(0)
        ->and($referralProject->sales()->where('type', 'referral')->firstOrFail()->amount)->toBe('5000.00')
        ->and($referralProject->invoices()->count())->toBe(0)
        ->and($referralProject->accountingTransactions()->count())->toBe(0)
        ->and($originalProject->sales()->where('type', 'referral')->count())->toBe(0)
        ->and($originalProject->invoices()->count())->toBe(0)
        ->and($originalProject->accountingTransactions()->count())->toBe(0);
});

test('the original sale can be edited but cannot be deleted', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);

    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), [
        'amount' => 12500,
    ]);

    $project = $lead->refresh()->project;
    $original = $project->sales()->where('type', 'original')->firstOrFail();

    $this->put(route('management.projects.sales.update', [$project, $original]), [
        'amount' => 14000,
        'sale_date' => '2026-07-18',
        'product_id' => $lead->product_id,
    ])->assertRedirect();

    expect($project->refresh()->amount)->toBe('14000.00');
    expect($original->refresh()->amount)->toBe('14000.00');

    $this->delete(route('management.projects.sales.destroy', [$project, $original]))
        ->assertUnprocessable();
    $this->assertDatabaseHas('project_sales', ['id' => $original->id]);
});

test('project scheduled payments can be added edited and deleted', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);

    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), [
        'amount' => 12500,
    ]);

    $project = $lead->refresh()->project;

    $this->post(route('management.projects.scheduled-payments.store', $project), [
        'expected_date' => '2026-08-01',
        'payment_stage' => 'Down Payment',
        'amount' => 2500,
        'qb' => true,
        'printed_sent' => false,
        'notes' => 'Initial deposit',
    ])->assertRedirect();

    $scheduledPayment = $project->scheduledPayments()->firstOrFail();
    $this->assertDatabaseHas('scheduled_payments', [
        'id' => $scheduledPayment->id,
        'project_id' => $project->id,
        'amount' => 2500,
        'payment_stage' => 'Down Payment',
    ]);

    $this->put(route('management.projects.scheduled-payments.update', [$project, $scheduledPayment]), [
        'expected_date' => '2026-08-05',
        'payment_stage' => 'Upon Material Delivery',
        'amount' => 3000,
        'qb' => false,
        'printed_sent' => true,
        'notes' => 'Updated schedule',
    ])->assertRedirect();

    expect($scheduledPayment->refresh())
        ->amount->toBe('3000.00')
        ->payment_stage->toBe('Upon Material Delivery')
        ->printed_sent->toBeTrue();

    $this->delete(route('management.projects.scheduled-payments.destroy', [$project, $scheduledPayment]))
        ->assertRedirect();
    $this->assertDatabaseMissing('scheduled_payments', ['id' => $scheduledPayment->id]);
});

test('scheduled payments cannot exceed the project contract total', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);

    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), [
        'amount' => 10000,
    ]);

    $project = $lead->refresh()->project;
    $payload = [
        'expected_date' => '2026-08-01',
        'payment_stage' => 'Down Payment',
        'qb' => false,
        'printed_sent' => false,
        'notes' => null,
    ];

    $this->post(route('management.projects.scheduled-payments.store', $project), [
        ...$payload,
        'amount' => 7500,
    ])->assertRedirect();

    $this->post(route('management.projects.scheduled-payments.store', $project), [
        ...$payload,
        'amount' => 2500.01,
    ])->assertSessionHasErrors('amount');

    expect((float) $project->scheduledPayments()->sum('amount'))->toBe(7500.0);
});

test('a project sale cannot be reduced below its scheduled payments', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);

    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), [
        'amount' => 10000,
    ]);

    $project = $lead->refresh()->project;
    $original = $project->sales()->where('type', 'original')->firstOrFail();

    $this->post(route('management.projects.scheduled-payments.store', $project), [
        'expected_date' => '2026-08-01',
        'payment_stage' => 'Down Payment',
        'amount' => 9000,
        'qb' => false,
        'printed_sent' => false,
        'notes' => null,
    ]);

    $this->put(route('management.projects.sales.update', [$project, $original]), [
        'amount' => 8000,
        'sale_date' => '2026-07-18',
        'product_id' => $lead->product_id,
    ])->assertSessionHasErrors('amount');

    expect($original->refresh()->amount)->toBe('10000.00');
});

test('project vendor invoices support files editing statuses and deletion', function () {
    Storage::fake('local');
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);
    $contractor = Contractor::query()->create([
        'contractor' => 'Invoice Contractor',
        'address' => '200 Vendor Street',
        'zip' => 90001,
        'city' => 'Los Angeles',
        'state' => 'CA',
        'email' => 'vendor@example.com',
        'phone' => 5551000,
        'license' => 12345,
        'lic_expire' => '2027-01-01',
        'worker_comp' => '2027-01-01',
        'insurance_expire' => '2027-01-01',
    ]);

    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), [
        'amount' => 10000,
    ]);
    $project = $lead->refresh()->project;

    $this->post(route('management.projects.invoices.store', $project), [
        'invoice_number' => 'INV#1001',
        'invoice_date' => '2026-07-16',
        'contractor_id' => $contractor->con_id,
        'amount' => 1250.50,
        'notes' => 'Roofing materials',
        'file' => UploadedFile::fake()->create('invoice.pdf', 100, 'application/pdf'),
    ])->assertRedirect();

    $invoice = $project->invoices()->firstOrFail();
    expect($invoice)
        ->status->toBe('pending')
        ->file_name->toBe('invoice.pdf');
    Storage::disk('local')->assertExists($invoice->file_path);

    $this->get(route('management.invoices'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('lead-workflow/vendor-invoices')
            ->has('invoices.data', 1)
            ->where('invoices.data.0.id', $invoice->id)
            ->where('invoices.data.0.project_id', $project->id)
            ->where('invoices.data.0.invoice_number', 'INV#1001')
            ->where('invoices.data.0.contractor.contractor', 'Invoice Contractor'));

    $this->get(route('management.projects.invoices.file', [$project, $invoice]))
        ->assertOk();

    $this->post(route('management.projects.invoices.update', [$project, $invoice]), [
        'invoice_number' => 'INV#1001-UPDATED',
        'invoice_date' => '2026-07-17',
        'contractor_id' => $contractor->con_id,
        'amount' => 1500,
        'notes' => 'Updated invoice',
    ])->assertRedirect();

    expect($invoice->refresh())
        ->invoice_number->toBe('INV#1001-UPDATED')
        ->amount->toBe('1500.00')
        ->status->toBe('pending');

    $filePath = $invoice->file_path;
    $drive = Mockery::mock(GoogleDriveProjectStorage::class);
    $drive->shouldReceive('configured')->once()->andReturnTrue();
    $drive->shouldReceive('deleteMirroredFile')->once()->andThrow(new RuntimeException('invalid_grant'));
    app()->instance(GoogleDriveProjectStorage::class, $drive);

    $this->delete(route('management.projects.invoices.file.destroy', [$project, $invoice]))
        ->assertRedirect()
        ->assertSessionHas('toast.type', 'warning');
    expect($invoice->refresh()->file_name)->toBeNull();
    Storage::disk('local')->assertMissing($filePath);

    $this->delete(route('management.projects.invoices.destroy', [$project, $invoice]))
        ->assertRedirect();
    $this->assertDatabaseMissing('project_invoices', ['id' => $invoice->id]);
    Storage::disk('local')->assertMissing($filePath);
});

test('project status follows accounting activity and paid invoice balances', function () {
    ['account' => $account, 'lead' => $lead] = projectSaleFixtures();

    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), [
        'amount' => 1000,
    ])->assertRedirect();

    $project = $lead->refresh()->project;
    expect($project->status)->toBe('new');

    $receivable = $project->accountingTransactions()->create([
        'type' => 'receivable',
        'category' => 'Customer Payment',
        'transaction_date' => '2026-08-28',
        'amount' => 100,
        'status' => 'deposit',
    ]);
    expect($project->refresh()->status)->toBe('progress');

    $receivable->delete();
    expect($project->refresh()->status)->toBe('new');

    $invoice = $project->invoices()->create([
        'invoice_number' => 'INV#STATUS',
        'invoice_date' => '2026-08-28',
        'amount' => 500,
        'status' => 'pending',
    ]);
    expect($project->refresh()->status)->toBe('progress');

    $payable = $project->accountingTransactions()->create([
        'project_invoice_id' => $invoice->id,
        'type' => 'payable',
        'category' => 'Vendor Payment',
        'transaction_date' => '2026-08-28',
        'amount' => 500,
        'status' => 'paid',
    ]);
    expect($invoice->refresh()->status)->toBe('paid')
        ->and($project->refresh()->status)->toBe('completed');

    $payable->update(['status' => 'pending']);
    expect($invoice->refresh()->status)->toBe('pending')
        ->and($project->refresh()->status)->toBe('progress');

    $project->update(['status' => 'canceled']);
    $payable->update(['status' => 'paid']);
    expect($project->refresh()->status)->toBe('canceled');
});

test('project invoices can be charged by a vendor instead of a contractor', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);
    $vendor = Vendor::query()->create(['vendor' => 'Project Supply Vendor']);

    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), [
        'amount' => 10000,
    ])->assertRedirect();
    $project = $lead->refresh()->project;

    $this->post(route('management.projects.invoices.store', $project), [
        'invoice_number' => 'INV#VENDOR-1',
        'invoice_date' => '2026-08-19',
        'vendor_id' => $vendor->vendor_id,
        'amount' => 750,
        'notes' => 'Vendor supplied materials',
    ])->assertRedirect();

    $invoice = $project->invoices()->firstOrFail();
    expect($invoice->contractor_id)->toBeNull()
        ->and($invoice->vendor_id)->toBe($vendor->vendor_id)
        ->and($invoice->vendor->vendor)->toBe('Project Supply Vendor');

    $this->post(route('management.projects.accounting-transactions.store', $project), [
        'type' => 'payable',
        'category' => 'Vendor Payment',
        'transaction_date' => '2026-08-19',
        'vendor_id' => $vendor->vendor_id,
        'payment_method' => 'check',
        'reference_number' => 'CH#VENDOR-1',
        'amount' => 100,
        'status' => 'paid',
        'project_invoice_id' => $invoice->id,
    ])->assertRedirect();

    $vendorPayable = $project->accountingTransactions()->where('type', 'payable')->firstOrFail();
    expect($vendorPayable->counterparty)
        ->toBe('Project Supply Vendor')
        ->and($vendorPayable->vendor_id)->toBe($vendor->vendor_id)
        ->and($vendorPayable->vendor->vendor)->toBe('Project Supply Vendor');

    $this->get(route('management.invoices'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('invoices.data.0.vendor.vendor', 'Project Supply Vendor')
            ->where('invoices.data.0.contractor', null));
});

test('project accounting supports standalone receivables optional schedules and payables', function () {
    Storage::fake('local');
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);
    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), [
        'amount' => 10000,
    ]);
    $project = $lead->refresh()->project;
    $scheduledPayment = $project->scheduledPayments()->create([
        'expected_date' => '2026-08-01',
        'payment_stage' => 'Down Payment',
        'amount' => 2500,
        'qb' => false,
        'printed_sent' => false,
    ]);

    $receivable = [
        'type' => 'receivable',
        'category' => 'Customer Payment',
        'transaction_date' => '2026-07-16',
        'payment_method' => 'check',
        'reference_number' => 'CH#1001',
        'counterparty' => 'A different submitted customer',
        'amount' => 1000,
        'status' => 'pending',
        'notes' => 'Standalone deposit',
    ];

    $this->post(route('management.projects.accounting-transactions.store', $project), $receivable)
        ->assertRedirect();
    $transaction = $project->accountingTransactions()->firstOrFail();
    expect($transaction->scheduledPayments)->toHaveCount(0);
    expect($transaction->counterparty)->toBe('Project Customer');

    $this->put(route('management.projects.accounting-transactions.update', [$project, $transaction]), [
        ...$receivable,
        'payment_method' => 'zelle',
        'reference_number' => 'ZELLEabc123',
        'scheduled_payment_ids' => [$scheduledPayment->id],
    ])->assertRedirect();
    expect($transaction->refresh()->scheduledPayments)->toHaveCount(1);

    $this->put(route('management.projects.accounting-transactions.update', [$project, $transaction]), [
        ...$receivable,
        'payment_method' => 'zelle',
        'reference_number' => 'ZELLEabc123',
        'status' => 'deposit',
        'scheduled_payment_ids' => [$scheduledPayment->id],
    ])->assertRedirect();
    expect($transaction->refresh()->status)->toBe('deposit');

    $this->post(route('management.projects.accounting-transactions.store', $project), [
        ...$receivable,
        'reference_number' => 'CH#OVER-SCHEDULE',
        'amount' => 1501,
        'status' => 'paid',
        'scheduled_payment_ids' => [$scheduledPayment->id],
    ])->assertSessionHasErrors('status');

    $this->post(route('management.projects.accounting-transactions.store', $project), [
        ...$receivable,
        'reference_number' => 'CH#OLD-STATUS',
        'status' => 'ok_to_pay',
    ])->assertSessionHasErrors('status');

    $this->post(route('management.projects.accounting-transactions.store', $project), [
        ...$receivable,
        'payment_method' => 'credit_card',
        'reference_number' => 'WRONG-100',
        'status' => 'deposit',
    ])->assertRedirect();

    expect($project->accountingTransactions()
        ->where('reference_number', 'CC-WRONG-100')
        ->exists())->toBeTrue();

    $contractor = Contractor::query()->create([
        'contractor' => 'Project Vendor',
        'address' => '300 Vendor Street',
        'zip' => 90001,
        'city' => 'Los Angeles',
        'state' => 'CA',
        'email' => 'payable@example.com',
        'phone' => 5552000,
    ]);
    $invoice = $project->invoices()->create([
        'contractor_id' => $contractor->con_id,
        'invoice_number' => 'INV#PAY-1',
        'invoice_date' => '2026-07-16',
        'amount' => 750,
        'status' => 'pending',
    ]);
    $payableFile = UploadedFile::fake()->create('payable.pdf', 100, 'application/pdf');

    $this->post(route('management.projects.accounting-transactions.store', $project), [
        ...$receivable,
        'type' => 'payable',
        'category' => 'Vendor Payment',
        'payment_method' => 'credit_card',
        'reference_number' => 'CC-5544',
        'counterparty' => 'Vendor',
        'amount' => 500,
        'status' => 'ok_to_pay',
        'contractor_id' => $contractor->con_id,
        'salesman_id' => $salesman->salesman_id,
        'project_invoice_id' => $invoice->id,
        'file' => $payableFile,
    ])->assertRedirect();

    expect($project->accountingTransactions()->where('type', 'payable')->count())->toBe(1);
    $payable = $project->accountingTransactions()->where('type', 'payable')->firstOrFail();
    expect($payable)
        ->counterparty->toBe('Project Vendor')
        ->requested_by->toBe($account->username)
        ->status->toBe('paid')
        ->payment_method->toBe('credit_card')
        ->reference_number->toBe('CC-5544')
        ->salesman_id->toBe($salesman->salesman_id)
        ->file_name->toBe('payable.pdf');
    Storage::disk('local')->assertExists($payable->file_path);

    $this->post(route('management.projects.accounting-transactions.store', $project), [
        ...$receivable,
        'type' => 'payable',
        'category' => 'Vendor Payment',
        'invoice_order_number' => 'PO-2026-1842',
        'payment_method' => null,
        'reference_number' => null,
        'amount' => 125,
        'status' => 'ok_to_pay',
        'contractor_id' => $contractor->con_id,
        'project_invoice_id' => null,
    ])->assertRedirect()->assertSessionHasNoErrors();

    $this->assertDatabaseHas('project_accounting_transactions', [
        'project_id' => $project->id,
        'type' => 'payable',
        'category' => 'Vendor Payment',
        'invoice_order_number' => 'PO-2026-1842',
        'amount' => 125,
        'project_invoice_id' => null,
    ]);

    $this->put(route('management.projects.accounting-transactions.update', [$project, $payable]), [
        ...$receivable,
        'type' => 'payable',
        'category' => 'Vendor Payment',
        'payment_method' => null,
        'reference_number' => null,
        'amount' => 500,
        'status' => 'ok_to_pay',
        'contractor_id' => $contractor->con_id,
        'project_invoice_id' => $invoice->id,
    ])->assertRedirect();

    expect($payable->refresh())
        ->status->toBe('ok_to_pay')
        ->payment_method->toBeNull()
        ->reference_number->toBeNull();

    $this->put(route('management.projects.accounting-transactions.update', [$project, $payable]), [
        ...$receivable,
        'type' => 'payable',
        'category' => 'Vendor Payment',
        'payment_method' => null,
        'reference_number' => null,
        'amount' => 500,
        'status' => 'paid',
        'contractor_id' => $contractor->con_id,
        'project_invoice_id' => $invoice->id,
    ])->assertSessionHasErrors('payment_method');

    $this->post(route('management.projects.accounting-transactions.store', $project), [
        ...$receivable,
        'type' => 'payable',
        'category' => 'Vendor Payment',
        'reference_number' => 'CH#OVER',
        'amount' => 251,
        'status' => 'paid',
        'contractor_id' => $contractor->con_id,
        'project_invoice_id' => $invoice->id,
    ])->assertSessionHasErrors('amount');
    $this->delete(route('management.projects.accounting-transactions.destroy', [$project, $transaction]))
        ->assertRedirect();
    $this->assertDatabaseMissing('project_accounting_transactions', ['id' => $transaction->id]);
});

test('invoice receivable and payable attachment uploads persist on their records', function () {
    Storage::fake('local');
    $drive = Mockery::mock(GoogleDriveProjectStorage::class);
    $drive->shouldReceive('mirror')->times(3)->andReturn([
        'id' => 'drive-file-id',
        'webViewLink' => 'https://drive.google.com/file/test',
    ]);
    app()->instance(GoogleDriveProjectStorage::class, $drive);

    ['account' => $account, 'lead' => $lead] = projectSaleFixtures();
    $project = Project::query()->create([
        'lead_id' => $lead->id,
        'project_number' => 'PC#9001',
        'amount' => 5000,
        'created_by' => $account->acc_id,
    ]);
    $invoice = ProjectInvoice::query()->create([
        'project_id' => $project->id,
        'invoice_number' => 'INV#UPLOAD',
        'invoice_date' => '2026-08-21',
        'amount' => 500,
        'status' => 'pending',
    ]);
    $receivable = ProjectAccountingTransaction::query()->create([
        'project_id' => $project->id,
        'type' => 'receivable',
        'category' => 'Customer Payment',
        'transaction_date' => '2026-08-21',
        'amount' => 250,
        'status' => 'pending',
    ]);
    $payable = ProjectAccountingTransaction::query()->create([
        'project_id' => $project->id,
        'type' => 'payable',
        'category' => 'Vendor Payment',
        'transaction_date' => '2026-08-21',
        'amount' => 100,
        'status' => 'ok_to_pay',
    ]);

    foreach ([
        ['invoice', $invoice->id, 'invoice.pdf', 'project_invoice_id'],
        ['accounting', $receivable->id, 'receivable.jfif', 'project_accounting_transaction_id'],
        ['accounting', $payable->id, 'payable.jpg', 'project_accounting_transaction_id'],
    ] as [$targetType, $targetId, $fileName, $foreignKey]) {
        $this->actingAs($account)
            ->post(route('management.projects.documents.store', $project), [
                'target_type' => $targetType,
                'target_id' => $targetId,
                'files' => [UploadedFile::fake()->create($fileName, 100, 'application/octet-stream')],
            ])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $document = $project->documents()->where($foreignKey, $targetId)->latest()->firstOrFail();
        expect($document->file_name)->toBe($fileName)
            ->and($document->drive_file_id)->toBe('drive-file-id');
        Storage::disk('local')->assertExists($document->file_path);
    }
});

test('an unassigned payable stores its selected company and invoice order number', function () {
    ['account' => $account, 'lead' => $lead] = projectSaleFixtures();

    $this->actingAs($account)
        ->post(route('management.accounting-transactions.store'), [
            'type' => 'payable',
            'project_id' => null,
            'company_id' => $lead->company_id,
            'transaction_date' => '2026-08-20',
            'amount' => 10000,
            'payment_method' => 'check',
            'reference_number' => 'CH#1111',
            'invoice_order_number' => 'COM',
            'status' => 'paid',
            'payable_for' => 'Werner Lopez',
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $this->assertDatabaseHas('project_accounting_transactions', [
        'project_id' => null,
        'company_id' => $lead->company_id,
        'type' => 'payable',
        'invoice_order_number' => 'COM',
        'payment_method' => 'check',
    ]);
});

test('a payable cannot connect a contractor to another contractors invoice', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);
    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), ['amount' => 10000]);
    $project = $lead->project()->firstOrFail();
    $firstContractor = Contractor::query()->create([
        'contractor' => 'Invoice Owner', 'address' => '', 'zip' => 0,
        'city' => '', 'state' => '', 'email' => '', 'phone' => 0,
    ]);
    $otherContractor = Contractor::query()->create([
        'contractor' => 'Different Contractor', 'address' => '', 'zip' => 0,
        'city' => '', 'state' => '', 'email' => '', 'phone' => 0,
    ]);
    $invoice = $project->invoices()->create([
        'contractor_id' => $firstContractor->con_id,
        'invoice_number' => 'INV#OWNER-ONLY',
        'invoice_date' => '2026-09-09',
        'amount' => 500,
        'status' => 'pending',
    ]);

    $this->post(route('management.accounting-transactions.store'), [
        'type' => 'payable',
        'project_id' => $project->id,
        'company_id' => $lead->company_id,
        'project_invoice_id' => $invoice->id,
        'contractor_id' => $otherContractor->con_id,
        'transaction_date' => '2026-09-09',
        'amount' => 100,
        'status' => 'pending',
    ])->assertSessionHasErrors('project_invoice_id');

    $this->assertDatabaseMissing('project_accounting_transactions', [
        'project_invoice_id' => $invoice->id,
        'contractor_id' => $otherContractor->con_id,
    ]);
});

test('receivables require payment details only when they are moved to qb', function () {
    ['account' => $account, 'lead' => $lead, 'salesman' => $salesman] = projectSaleFixtures();
    $lead->update(['salesman_1_id' => $salesman->salesman_id]);
    $this->actingAs($account)->post(route('lead-workflow.leads-shop.sale', $lead), [
        'amount' => 10000,
    ]);
    $project = $lead->refresh()->project;

    $this->post(route('management.projects.accounting-transactions.store', $project), [
        'type' => 'receivable',
        'category' => 'Customer Payment',
        'transaction_date' => '2026-08-13',
        'amount' => 500,
        'status' => 'pending',
    ])->assertRedirect();

    $receivable = $project->accountingTransactions()->latest('id')->firstOrFail();
    expect($receivable->payment_method)->toBeNull()
        ->and($receivable->reference_number)->toBeNull()
        ->and($receivable->qb)->toBeFalse();

    $this->patch(route('management.projects.accounting-transactions.qb', [$project, $receivable]), [
        'qb' => true,
    ])->assertSessionHasErrors(['payment_method', 'reference_number']);

    $this->patch(route('management.projects.accounting-transactions.qb', [$project, $receivable]), [
        'qb' => true,
        'payment_method' => 'check',
        'reference_number' => 'CH#9001',
    ])->assertRedirect();

    expect($receivable->refresh()->qb)->toBeTrue()
        ->and($receivable->status)->toBe('deposit')
        ->and($receivable->payment_method)->toBe('check')
        ->and($receivable->reference_number)->toBe('CH#9001');

    $this->patch(route('management.projects.accounting-transactions.qb', [$project, $receivable]), [
        'qb' => false,
    ])->assertRedirect();

    expect($receivable->refresh()->qb)->toBeFalse()
        ->and($receivable->status)->toBe('deposit');
});
