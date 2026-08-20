<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProjectAccountingTransactionRequest;
use App\Http\Requests\ProjectDetailsRequest;
use App\Http\Requests\ProjectInvoiceRequest;
use App\Http\Requests\ReceivableQuickBooksRequest;
use App\Http\Requests\ProjectSaleRequest;
use App\Http\Requests\ProjectStoreRequest;
use App\Http\Requests\ScheduledPaymentRequest;
use App\Models\Agent;
use App\Models\Company;
use App\Models\Contractor;
use App\Models\Lead;
use App\Models\Manager;
use App\Models\Product;
use App\Models\Project;
use App\Models\ProjectAccountingTransaction;
use App\Models\ProjectInvoice;
use App\Models\ProjectDocument;
use App\Models\ProjectSale;
use App\Models\Salesman;
use App\Models\Vendor;
use App\Models\ScheduledPayment;
use App\Services\GoogleDriveProjectStorage;
use App\Services\ProjectNumberAllocator;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class ProjectController extends Controller
{
    public function __construct(private readonly GoogleDriveProjectStorage $googleDrive) {}

    public function index(): Response
    {
        return Inertia::render('management/projects', [
            'projects' => Project::query()
                ->with([
                    'lead.company:com_id,company,prefix',
                    'lead.product:prod_id,product_name',
                    'lead.agent:agent_id,agent_name',
                    'lead.secondAgent:agent_id,agent_name',
                    'lead.salesmanOne:salesman_id,salesman_name,phone',
                    'lead.salesmanTwo:salesman_id,salesman_name,phone',
                    'lead.notes:id,lead_id,note_type,body,created_at',
                    'sales.product:prod_id,product_name',
                    'scheduledPayments',
                    'invoices.contractor:con_id,contractor',
                    'invoices.vendor:vendor_id,vendor',
                    'accountingTransactions.scheduledPayments',
                    'accountingTransactions.invoice.contractor:con_id,contractor',
                    'accountingTransactions.invoice.vendor:vendor_id,vendor',
                    'accountingTransactions.contractor:con_id,contractor',
                    'documents:id,project_id,project_invoice_id,project_accounting_transaction_id,project_sale_id,category,file_name,file_mime,file_size,created_at',
                    'company:com_id,company,prefix',
                    'product:prod_id,product_name',
                    'telemarketer:agent_id,agent_name',
                    'salesman:salesman_id,salesman_name,phone',
                    'manager:manager_id,manager_name',
                    'contractors:con_id,contractor',
                ])
                ->latest()
                ->get()
                ->each(fn (Project $project) => $this->hydrateStandaloneProject($project)),
            'products' => Product::query()->orderBy('product_name')->get(['prod_id', 'product_name']),
            'companies' => Company::query()->orderBy('company')->get(['com_id', 'company', 'prefix']),
            'agents' => Agent::query()
                ->whereNull('inactive_at')
                ->orderBy('agent_name')
                ->get(['agent_id', 'agent_name']),
            'salesmen' => Salesman::query()
                ->whereNull('inactive_at')
                ->orderBy('salesman_name')
                ->get(['salesman_id', 'salesman_name', 'phone']),
            'managers' => Manager::query()
                ->orderBy('manager_name')
                ->get(['manager_id', 'manager_name']),
            'contractors' => Contractor::query()->whereNull('moved_to_vendor_at')->orderBy('contractor')->get(['con_id', 'contractor']),
            'vendors' => Vendor::query()->orderBy('vendor')->get(['vendor_id', 'vendor']),
            'requesters' => Manager::query()->orderBy('manager_name')->pluck('manager_name')->values(),
            'currentRequester' => request()->user()?->manager?->manager_name ?: request()->user()?->username,
            'googleDriveUrl' => filled(config('services.google_drive.root_folder_id'))
                ? 'https://drive.google.com/drive/folders/'.config('services.google_drive.root_folder_id')
                : null,
        ]);
    }

    public function store(ProjectStoreRequest $request, ProjectNumberAllocator $projectNumbers): RedirectResponse
    {
        $data = $request->validated();

        $project = DB::transaction(function () use ($request, $data, $projectNumbers): Project {
            $project = Project::query()->create([
                'lead_id' => null,
                'project_number' => filled($data['project_number'] ?? null)
                    ? $projectNumbers->normalizeForCompany((int) $data['company_id'], $data['project_number'])
                    : $projectNumbers->allocateForCompany((int) $data['company_id']),
                'customer_name' => $data['customer_name'],
                'contact_name' => $data['contact_name'] ?? null,
                'company_id' => $data['company_id'],
                'product_id' => $data['product_id'],
                'telemarketer_id' => $data['telemarketer_id'] ?? null,
                'salesman_id' => $data['salesman_id'] ?? null,
                'manager_id' => $data['manager_id'] ?? null,
                'primary_number' => $data['primary_number'],
                'mobile_number' => $data['mobile_number'] ?? null,
                'email' => $data['email'] ?? null,
                'address' => $data['address'] ?? null,
                'city' => $data['city'] ?? null,
                'state' => $data['state'] ?? null,
                'zip_code' => $data['zip_code'] ?? null,
                'amount' => $data['amount'],
                'budget' => $data['budget'] ?? null,
                'manual_notes' => $data['notes'] ?? null,
                'status' => $data['status'],
                'created_by' => $request->user()->getAuthIdentifier(),
            ]);

            $project->forceFill([
                'created_at' => $data['signed_date'].' 12:00:00',
                'updated_at' => now(),
            ])->saveQuietly();

            $project->sales()->create([
                'type' => 'original',
                'amount' => $data['amount'],
                'sale_date' => $data['signed_date'],
                'product_id' => $data['product_id'],
            ]);

            return $project;
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Project added successfully.']);

        return to_route('management.projects', ['project' => $project->id]);
    }

    public function updateContractors(Request $request, Project $project): RedirectResponse
    {
        $data = $request->validate([
            'contractor_ids' => ['required', 'array', 'size:4'],
            'contractor_ids.*' => ['nullable', 'integer', 'distinct', 'exists:contractors,con_id'],
        ]);

        $assignments = collect($data['contractor_ids'])
            ->filter()
            ->mapWithKeys(fn ($contractorId, $position) => [
                (int) $contractorId => ['position' => $position + 1],
            ])
            ->all();

        $project->contractors()->sync($assignments);

        return back()->with('success', 'Project contractors saved.');
    }

    public function updateTeleLeadVisibility(Project $project): RedirectResponse
    {
        if (! $project->lead_id) {
            Inertia::flash('toast', [
                'type' => 'info',
                'message' => 'This standalone project is already project-only.',
            ]);

            return back();
        }

        $data = request()->validate([
            'project_only' => ['required', 'boolean'],
        ]);

        $project->update([
            'tele_lead_excluded' => $data['project_only'],
        ]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $data['project_only']
                ? 'Project removed from Tele Leads.'
                : 'Project restored to Tele Leads.',
        ]);

        return back();
    }

    public function bulkUpdateTeleLeadVisibility(): RedirectResponse
    {
        $data = request()->validate([
            'project_ids' => ['required', 'array', 'min:1'],
            'project_ids.*' => ['required', 'integer', 'distinct', 'exists:projects,id'],
            'project_only' => ['required', 'boolean'],
        ]);

        $updated = Project::query()
            ->whereIn('id', $data['project_ids'])
            ->whereNotNull('lead_id')
            ->update(['tele_lead_excluded' => $data['project_only']]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $data['project_only']
                ? "{$updated} projects removed from Tele Leads."
                : "{$updated} projects restored to Tele Leads.",
        ]);

        return back();
    }

    private function hydrateStandaloneProject(Project $project): void
    {
        if ($project->lead !== null) {
            return;
        }

        $lead = new Lead([
            'customer_name' => $project->customer_name,
            'primary_number' => $project->primary_number,
            'secondary_number' => null,
            'mobile_number' => $project->mobile_number,
            'email' => $project->email,
            'address' => $project->address ?? '',
            'city' => $project->city ?? '',
            'state' => $project->state ?? '',
            'zip_code' => $project->zip_code ?? '',
            'source' => 'Manual Project',
            'appointment_at' => null,
            'telemarketer_notes' => $project->manual_notes ?? '',
        ]);
        $lead->id = 0;
        $lead->created_at = $project->created_at;
        $lead->setRelation('company', $project->company);
        $lead->setRelation('product', $project->product);
        $lead->setRelation('agent', $project->telemarketer);
        $lead->setRelation('secondAgent', null);
        $lead->setRelation('salesmanOne', $project->salesman);
        $lead->setRelation('salesmanTwo', null);
        $lead->setRelation('notes', $lead->newCollection());
        $project->setRelation('lead', $lead);
    }

    public function storeReferral(ProjectSaleRequest $request, Project $project): RedirectResponse
    {
        $sale = $project->sales()->create([
            ...$request->safe()->except('files'),
            'type' => 'referral',
        ]);

        $driveFailures = $this->storeSaleDocuments($request, $project, $sale);

        Inertia::flash('toast', $this->driveSyncToast('Referral sale added.', $driveFailures === 0));

        return back();
    }

    public function updateDetails(
        ProjectDetailsRequest $request,
        Project $project,
        ProjectNumberAllocator $projectNumbers,
    ): RedirectResponse {
        $data = $request->validated();

        DB::transaction(function () use ($project, $data, $projectNumbers): void {
            $companyId = (int) ($data['company_id'] ?? 0);
            $currentCompanyId = (int) ($project->lead?->company_id ?? $project->company_id ?? 0);
            $requestedNumber = filled($data['project_number'] ?? null)
                ? (string) $data['project_number']
                : (string) ($project->project_number ?? '');
            $projectNumber = $companyId > 0
                ? ($currentCompanyId > 0 && $currentCompanyId !== $companyId
                    ? $projectNumbers->allocateForCompany($companyId)
                    : (filled($requestedNumber)
                    ? $projectNumbers->normalizeForCompany($companyId, $requestedNumber, $project->id)
                    : $projectNumbers->allocateForCompany($companyId)))
                : $project->project_number;

            $project->update([
                'project_number' => $projectNumber,
                'status' => $data['status'],
            ]);
            $lead = $project->lead()->first();

            if (! $lead) {
                $project->update([
                    'company_id' => $data['company_id'],
                    'product_id' => $data['product_id'],
                    'customer_name' => $data['customer_name'],
                    'primary_number' => $data['primary_number'] ?? '',
                    'mobile_number' => $data['mobile_number'] ?? null,
                    'email' => $data['email'] ?? null,
                    'address' => $data['address'] ?? '',
                    'city' => $data['city'] ?? '',
                    'state' => $data['state'] ?? '',
                    'zip_code' => $data['zip_code'] ?? '',
                    'telemarketer_id' => array_key_exists('agent_id', $data) && $data['agent_id'] !== null
                        ? $data['agent_id']
                        : $project->telemarketer_id,
                    'salesman_id' => array_key_exists('salesman_1_id', $data)
                        ? $data['salesman_1_id']
                        : $project->salesman_id,
                ]);
                $project->forceFill([
                    'created_at' => Carbon::parse($data['lead_created_at'], config('app.timezone')),
                ])->saveQuietly();
                $project->sales()->where('type', 'original')->update([
                    'product_id' => $data['product_id'],
                ]);

                return;
            }

            $lead->fill([
                'company_id' => $data['company_id'],
                'product_id' => $data['product_id'],
                'customer_name' => $data['customer_name'],
                'primary_number' => $data['primary_number'] ?? '',
                'secondary_number' => $data['secondary_number'] ?? null,
                'mobile_number' => $data['mobile_number'] ?? null,
                'email' => $data['email'] ?? null,
                'address' => $data['address'] ?? '',
                'city' => $data['city'] ?? '',
                'state' => $data['state'] ?? '',
                'zip_code' => $data['zip_code'] ?? '',
                'source' => $data['source'] ?? '',
                'appointment_at' => $data['appointment_at'] ?? null,
                'agent_id' => array_key_exists('agent_id', $data) && $data['agent_id'] !== null
                    ? $data['agent_id']
                    : $lead->agent_id,
                'agent_2_id' => array_key_exists('agent_2_id', $data)
                    ? $data['agent_2_id']
                    : $lead->agent_2_id,
                'salesman_1_id' => array_key_exists('salesman_1_id', $data)
                    ? $data['salesman_1_id']
                    : $lead->salesman_1_id,
                'salesman_2_id' => array_key_exists('salesman_2_id', $data)
                    ? $data['salesman_2_id']
                    : $lead->salesman_2_id,
            ]);
            $lead->created_at = Carbon::parse($data['lead_created_at'], config('app.timezone'));
            $lead->save();
            $project->sales()->where('type', 'original')->update([
                'product_id' => $data['product_id'],
            ]);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Project details updated.']);

        return back();
    }

    public function syncDriveFolders(): RedirectResponse
    {
        try {
            $result = $this->googleDrive->syncProjectFolders(
                Project::query()->with('lead:id,customer_name')->lazyById(),
            );

            $message = "Google Drive folder sync finished: {$result['created']} created, {$result['skipped']} already existed";
            if ($result['failed'] > 0) {
                $message .= ", {$result['failed']} failed";
            }

            Inertia::flash('toast', [
                'type' => $result['failed'] > 0 ? 'warning' : 'success',
                'message' => $message.'.',
            ]);
        } catch (Throwable $exception) {
            Log::error('Google Drive project folder sync failed.', ['exception' => $exception]);
            Inertia::flash('toast', [
                'type' => 'error',
                'message' => 'Google Drive folder sync could not be completed. Test the Drive connection and try again.',
            ]);
        }

        return back();
    }

    public function updateSale(ProjectSaleRequest $request, Project $project, ProjectSale $sale): RedirectResponse
    {
        abort_unless($sale->project_id === $project->id, 404);

        DB::transaction(function () use ($request, $project, $sale): void {
            $lockedProject = Project::query()->lockForUpdate()->findOrFail($project->id);
            $prospectiveContractTotal = (float) $lockedProject->sales()->sum('amount')
                - (float) $sale->amount
                + (float) $request->validated('amount');
            $this->ensureContractCoversScheduledPayments($lockedProject, $prospectiveContractTotal);
            $sale->update($request->safe()->except('files'));

            if ($sale->type === 'original') {
                $project->update(['amount' => $request->validated('amount')]);
                if ($project->lead_id) {
                    $project->lead()->update(['product_id' => $request->validated('product_id')]);
                } else {
                    $project->update(['product_id' => $request->validated('product_id')]);
                }
            }
        });

        $driveFailures = $this->storeSaleDocuments($request, $project, $sale);

        Inertia::flash('toast', $this->driveSyncToast(ucfirst($sale->type).' sale updated.', $driveFailures === 0));

        return back();
    }

    public function destroySale(Project $project, ProjectSale $sale): RedirectResponse
    {
        abort_unless($sale->project_id === $project->id, 404);
        abort_if($sale->type === 'original', 422, 'The original sale cannot be deleted.');

        DB::transaction(function () use ($project, $sale): void {
            $lockedProject = Project::query()->lockForUpdate()->findOrFail($project->id);
            $prospectiveContractTotal = (float) $lockedProject->sales()->sum('amount') - (float) $sale->amount;
            $this->ensureContractCoversScheduledPayments($lockedProject, $prospectiveContractTotal);
            $sale->delete();
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Referral sale deleted.']);

        return back();
    }

    public function storeScheduledPayment(ScheduledPaymentRequest $request, Project $project): RedirectResponse
    {
        DB::transaction(function () use ($request, $project): void {
            $lockedProject = Project::query()->lockForUpdate()->findOrFail($project->id);
            $this->ensureScheduledTotalFitsContract(
                $lockedProject,
                (float) $request->validated('amount'),
            );
            $lockedProject->scheduledPayments()->create($request->validated());
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Scheduled payment added.']);

        return back();
    }

    public function updateScheduledPayment(
        ScheduledPaymentRequest $request,
        Project $project,
        ScheduledPayment $scheduledPayment,
    ): RedirectResponse {
        abort_unless($scheduledPayment->project_id === $project->id, 404);

        DB::transaction(function () use ($request, $project, $scheduledPayment): void {
            $lockedProject = Project::query()->lockForUpdate()->findOrFail($project->id);
            $this->ensureScheduledTotalFitsContract(
                $lockedProject,
                (float) $request->validated('amount'),
                $scheduledPayment->id,
            );
            $scheduledPayment->update($request->validated());
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Scheduled payment updated.']);

        return back();
    }

    public function destroyScheduledPayment(Project $project, ScheduledPayment $scheduledPayment): RedirectResponse
    {
        abort_unless($scheduledPayment->project_id === $project->id, 404);

        $scheduledPayment->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Scheduled payment deleted.']);

        return back();
    }

    public function storeInvoice(ProjectInvoiceRequest $request, Project $project): RedirectResponse
    {
        $data = $request->safe()->except(['file']);
        $data = $this->withSelectedProjectDocument($project, $data);

        if ($file = $request->file('file')) {
            $data = [
                ...$data,
                'project_document_id' => null,
                'file_path' => $file->store("project-invoices/{$project->id}", 'local'),
                'file_name' => $file->getClientOriginalName(),
                'file_mime' => $file->getMimeType(),
                'file_size' => $file->getSize(),
            ];
        }

        $invoice = $project->invoices()->create($data);
        $driveSync = $this->mirrorProjectFile(
            $project,
            $invoice->file_path,
            $invoice->file_name,
            $invoice->file_mime,
        );

        Inertia::flash('toast', $this->driveSyncToast('Vendor payment added.', $driveSync));

        return back();
    }

    public function updateInvoice(
        ProjectInvoiceRequest $request,
        Project $project,
        ProjectInvoice $invoice,
    ): RedirectResponse {
        $this->ensureInvoiceBelongsToProject($project, $invoice);
        $data = $request->safe()->except(['file']);
        $data = $this->withSelectedProjectDocument($project, $data);
        $oldFilePath = $invoice->file_path;
        $oldDocumentId = $invoice->project_document_id;

        if ($file = $request->file('file')) {
            $data = [
                ...$data,
                'project_document_id' => null,
                'file_path' => $file->store("project-invoices/{$project->id}", 'local'),
                'file_name' => $file->getClientOriginalName(),
                'file_mime' => $file->getMimeType(),
                'file_size' => $file->getSize(),
            ];
        }

        $invoice->update($data);
        $invoice->syncStatusFromPayables();

        if ($request->hasFile('file') && $oldFilePath && ! $oldDocumentId) {
            Storage::disk('local')->delete($oldFilePath);
        }

        $driveSync = $request->hasFile('file')
            ? $this->mirrorProjectFile(
                $project,
                $invoice->file_path,
                $invoice->file_name,
                $invoice->file_mime,
            )
            : null;

        Inertia::flash('toast', $this->driveSyncToast('Vendor payment updated.', $driveSync));

        return back();
    }

    public function destroyInvoice(Project $project, ProjectInvoice $invoice): RedirectResponse
    {
        $this->ensureInvoiceBelongsToProject($project, $invoice);
        $filePath = $invoice->file_path;
        $invoice->delete();

        if ($filePath && ! $invoice->project_document_id) {
            Storage::disk('local')->delete($filePath);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Vendor payment deleted.']);

        return back();
    }

    public function showInvoiceFile(Project $project, ProjectInvoice $invoice): StreamedResponse
    {
        $this->ensureInvoiceBelongsToProject($project, $invoice);
        abort_unless($invoice->file_path && Storage::disk('local')->exists($invoice->file_path), 404);

        return Storage::disk('local')->response(
            $invoice->file_path,
            $invoice->file_name,
            ['Content-Disposition' => 'inline'],
        );
    }

    public function showContractFile(Project $project): StreamedResponse
    {
        abort_unless(
            $project->contract_file_path
            && Storage::disk('local')->exists($project->contract_file_path),
            404,
        );

        return Storage::disk('local')->response(
            $project->contract_file_path,
            $project->contract_file_name ?: basename($project->contract_file_path),
            ['Content-Type' => $project->contract_file_mime ?: 'application/octet-stream'],
        );
    }

    public function storeAccountingTransaction(
        ProjectAccountingTransactionRequest $request,
        Project $project,
    ): RedirectResponse {
        $unassigned = $request->boolean('unassigned');
        $data = $request->safe()->except(['scheduled_payment_ids', 'file', 'unassigned']);
        $scheduledPaymentIds = $data['type'] === 'receivable' ? $request->input('scheduled_payment_ids', []) : [];
        if ($unassigned) {
            $scheduledPaymentIds = [];
        }
        $data['project_invoice_id'] = $data['type'] === 'payable' ? ($data['project_invoice_id'] ?? null) : null;
        if ($unassigned) {
            $data['project_invoice_id'] = null;
            $data['project_document_id'] = null;
        } else {
            $data = $this->withSelectedProjectDocument($project, $data);
        }
        $data['contractor_id'] = $data['type'] === 'payable' ? ($data['contractor_id'] ?? null) : null;
        if ($data['type'] === 'payable' && $data['status'] !== 'paid') {
            $data['payment_method'] = null;
            $data['reference_number'] = null;
        }
        $data['counterparty'] = $unassigned && $data['type'] === 'receivable'
            ? ($data['counterparty'] ?? null)
            : $this->accountingCounterparty($project, $data['type'], $data['contractor_id'], $data['project_invoice_id']);
        $data['requested_by'] = ($data['requested_by'] ?? null) ?: ($request->user()?->manager?->manager_name ?: $request->user()?->username);
        if (! $unassigned) {
            $this->ensureAccountingLinksBelongToProject($project, $data, $scheduledPaymentIds);
            $this->ensureReceivableFitsScheduledPayments($project, $data, $scheduledPaymentIds);
            $this->ensurePayableFitsInvoice($data);
        }
        $data = $this->withAccountingFile($request, $unassigned ? null : $project, $data);

        $transaction = DB::transaction(function () use ($project, $data, $scheduledPaymentIds, $unassigned): ProjectAccountingTransaction {
            $transaction = ProjectAccountingTransaction::query()->create([
                ...$data,
                'project_id' => $unassigned ? null : $project->id,
            ]);
            $transaction->scheduledPayments()->sync($scheduledPaymentIds);

            return $transaction;
        });

        $driveSync = $unassigned
            ? null
            : $this->mirrorProjectFile(
                $project,
                $transaction->file_path,
                $transaction->file_name,
                $transaction->file_mime,
            );

        Inertia::flash('toast', $this->driveSyncToast(ucfirst($data['type']).' added.', $driveSync));

        return back();
    }

    public function updateAccountingTransaction(
        ProjectAccountingTransactionRequest $request,
        Project $project,
        ProjectAccountingTransaction $accountingTransaction,
    ): RedirectResponse {
        abort_unless($accountingTransaction->project_id === $project->id, 404);
        $data = $request->safe()->except(['scheduled_payment_ids', 'file']);
        $data = $this->withSelectedProjectDocument($project, $data);
        $scheduledPaymentIds = $data['type'] === 'receivable' ? $request->input('scheduled_payment_ids', []) : [];
        $data['project_invoice_id'] = $data['type'] === 'payable' ? ($data['project_invoice_id'] ?? null) : null;
        $data['contractor_id'] = $data['type'] === 'payable' ? ($data['contractor_id'] ?? null) : null;
        if ($data['type'] === 'payable' && $data['status'] !== 'paid') {
            $data['payment_method'] = null;
            $data['reference_number'] = null;
        }
        $data['counterparty'] = $this->accountingCounterparty($project, $data['type'], $data['contractor_id'], $data['project_invoice_id']);
        $data['requested_by'] = ($data['requested_by'] ?? null) ?: $accountingTransaction->requested_by ?: ($request->user()?->manager?->manager_name ?: $request->user()?->username);
        $oldFilePath = $accountingTransaction->file_path;
        $oldDocumentId = $accountingTransaction->project_document_id;
        $this->ensureAccountingLinksBelongToProject($project, $data, $scheduledPaymentIds);
        $this->ensureReceivableFitsScheduledPayments($project, $data, $scheduledPaymentIds, $accountingTransaction->id);
        $this->ensurePayableFitsInvoice($data, $accountingTransaction->id);
        $data = $this->withAccountingFile($request, $project, $data);

        DB::transaction(function () use ($accountingTransaction, $data, $scheduledPaymentIds): void {
            $accountingTransaction->update($data);
            $accountingTransaction->scheduledPayments()->sync($scheduledPaymentIds);
        });

        if ($request->hasFile('file') && $oldFilePath && ! $oldDocumentId) {
            Storage::disk('local')->delete($oldFilePath);
        }

        $driveSync = $request->hasFile('file')
            ? $this->mirrorProjectFile(
                $project,
                $accountingTransaction->file_path,
                $accountingTransaction->file_name,
                $accountingTransaction->file_mime,
            )
            : null;

        Inertia::flash('toast', $this->driveSyncToast(ucfirst($data['type']).' updated.', $driveSync));

        return back();
    }

    public function destroyAccountingTransaction(
        Project $project,
        ProjectAccountingTransaction $accountingTransaction,
    ): RedirectResponse {
        abort_unless($accountingTransaction->project_id === $project->id, 404);
        $filePath = $accountingTransaction->file_path;
        $documentId = $accountingTransaction->project_document_id;
        $accountingTransaction->delete();

        if ($filePath && ! $documentId) {
            Storage::disk('local')->delete($filePath);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Accounting transaction deleted.']);

        return back();
    }

    public function showProjectDocument(Project $project, ProjectDocument $document): StreamedResponse
    {
        abort_unless($document->project_id === $project->id && Storage::disk('local')->exists($document->file_path), 404);

        return Storage::disk('local')->response($document->file_path, $document->file_name, ['Content-Disposition' => 'inline']);
    }

    public function storeProjectDocuments(
        Request $request,
        Project $project,
        GoogleDriveProjectStorage $drive,
    ): RedirectResponse {
        $data = $request->validate([
            'files' => ['required', 'array', 'min:1', 'max:20'],
            'files.*' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp,heic,heif', 'max:20480'],
            'target_type' => ['required', 'in:project,invoice,accounting,sale'],
            'target_id' => ['nullable', 'integer'],
        ]);

        $invoice = null;
        $transaction = null;
        $sale = null;
        if ($data['target_type'] === 'invoice') {
            $invoice = $project->invoices()->findOrFail($data['target_id'] ?? 0);
        } elseif ($data['target_type'] === 'accounting') {
            $transaction = $project->accountingTransactions()->findOrFail($data['target_id'] ?? 0);
        } elseif ($data['target_type'] === 'sale') {
            $sale = $project->sales()->findOrFail($data['target_id'] ?? 0);
        }

        $category = $sale
            ? 'Sale Contract'
            : ($invoice
            ? 'Invoice'
            : ($transaction
                ? ($transaction->type === 'receivable' ? 'Receivable' : 'Payable')
                : 'Project Upload'));
        $driveFailures = 0;

        foreach ($data['files'] as $file) {
            $path = $file->store("project-documents/{$project->id}", 'local');
            $document = $project->documents()->create([
                'project_invoice_id' => $invoice?->id,
                'project_accounting_transaction_id' => $transaction?->id,
                'project_sale_id' => $sale?->id,
                'uploaded_by' => $request->user()?->getAuthIdentifier(),
                'category' => $category,
                'file_path' => $path,
                'file_name' => $file->getClientOriginalName(),
                'file_mime' => $file->getMimeType(),
                'file_size' => $file->getSize(),
            ]);

            try {
                $mirrored = $drive->mirror($project, $path, $document->file_name, $document->file_mime);
                $document->update([
                    'drive_file_id' => $mirrored['id'] ?? null,
                    'drive_url' => $mirrored['webViewLink'] ?? null,
                ]);
            } catch (Throwable $exception) {
                $driveFailures++;
                Log::warning('Project DOC upload Drive sync failed.', [
                    'project_id' => $project->id,
                    'document_id' => $document->id,
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        Inertia::flash('toast', [
            'type' => $driveFailures ? 'warning' : 'success',
            'message' => $driveFailures
                ? 'Files saved in CRM; some Google Drive uploads need retrying.'
                : 'Files uploaded to the record, project DOC tab, and Google Drive.',
        ]);

        return back();
    }

    public function updateReceivableQuickBooks(
        ReceivableQuickBooksRequest $request,
        Project $project,
        ProjectAccountingTransaction $accountingTransaction,
    ): RedirectResponse {
        abort_unless(
            $accountingTransaction->project_id === $project->id
            && $accountingTransaction->type === 'receivable',
            404,
        );

        if (! $request->boolean('qb')) {
            $accountingTransaction->update(['qb' => false]);

            return back();
        }

        $paymentMethod = $request->input('payment_method') ?: $accountingTransaction->payment_method;
        $referenceNumber = $request->input('reference_number') ?: $accountingTransaction->reference_number;
        $scheduledPaymentIds = $accountingTransaction->scheduledPayments()->pluck('scheduled_payments.id')->all();
        $data = [
            'type' => 'receivable',
            'status' => 'deposit',
            'amount' => $accountingTransaction->amount,
        ];

        $this->ensureReceivableFitsScheduledPayments(
            $project,
            $data,
            $scheduledPaymentIds,
            $accountingTransaction->id,
        );

        $accountingTransaction->update([
            'qb' => true,
            'status' => 'deposit',
            'payment_method' => $paymentMethod,
            'reference_number' => $referenceNumber,
        ]);

        return back()->with('success', 'Receivable moved to QB and marked as Deposit.');
    }

    public function showAccountingTransactionFile(
        Project $project,
        ProjectAccountingTransaction $accountingTransaction,
    ): StreamedResponse {
        abort_unless($accountingTransaction->project_id === $project->id, 404);
        abort_unless(
            $accountingTransaction->file_path
            && Storage::disk('local')->exists($accountingTransaction->file_path),
            404,
        );

        return Storage::disk('local')->response(
            $accountingTransaction->file_path,
            $accountingTransaction->file_name,
            ['Content-Disposition' => 'inline'],
        );
    }

    private function accountingCounterparty(
        Project $project,
        string $type,
        ?int $contractorId,
        ?int $invoiceId = null,
    ): ?string
    {
        if ($type === 'receivable') {
            return $project->lead()->value('customer_name') ?: $project->customer_name;
        }

        if ($contractorId) {
            return Contractor::query()->whereKey($contractorId)->value('contractor');
        }

        return $invoiceId
            ? $project->invoices()->whereKey($invoiceId)->first()?->vendor()->value('vendor')
            : null;
    }

    private function mirrorProjectFile(
        Project $project,
        ?string $path,
        ?string $fileName,
        ?string $mimeType,
    ): ?bool {
        if (! $path || ! $fileName || ! $this->googleDrive->configured()) {
            return null;
        }

        try {
            $this->googleDrive->mirror($project, $path, $fileName, $mimeType);

            return true;
        } catch (Throwable $exception) {
            Log::error('Google Drive project file sync failed.', [
                'project_id' => $project->id,
                'file_path' => $path,
                'exception' => $exception,
            ]);

            return false;
        }
    }

    private function storeSaleDocuments(ProjectSaleRequest $request, Project $project, ProjectSale $sale): int
    {
        $failures = 0;

        foreach ($request->file('files', []) as $file) {
            $path = $file->store("project-documents/{$project->id}", 'local');
            $document = $project->documents()->create([
                'project_sale_id' => $sale->id,
                'uploaded_by' => $request->user()?->getAuthIdentifier(),
                'category' => 'Sale Contract',
                'file_path' => $path,
                'file_name' => $file->getClientOriginalName(),
                'file_mime' => $file->getMimeType(),
                'file_size' => $file->getSize(),
            ]);

            if (! $this->googleDrive->configured()) {
                continue;
            }

            try {
                $mirrored = $this->googleDrive->mirror($project, $path, $document->file_name, $document->file_mime);
                $document->update([
                    'drive_file_id' => $mirrored['id'] ?? null,
                    'drive_url' => $mirrored['webViewLink'] ?? null,
                ]);
            } catch (Throwable $exception) {
                $failures++;
                Log::warning('Sale attachment Drive sync failed.', [
                    'project_id' => $project->id,
                    'sale_id' => $sale->id,
                    'document_id' => $document->id,
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        return $failures;
    }

    /** @return array{type: string, message: string} */
    private function driveSyncToast(string $message, ?bool $driveSync): array
    {
        return match ($driveSync) {
            true => ['type' => 'success', 'message' => $message.' Synced to Google Drive.'],
            false => ['type' => 'warning', 'message' => $message.' Google Drive sync failed; the CRM copy is safe.'],
            null => ['type' => 'success', 'message' => $message],
        };
    }

    private function withAccountingFile(
        ProjectAccountingTransactionRequest $request,
        ?Project $project,
        array $data,
    ): array {
        if (! $file = $request->file('file')) {
            return $data;
        }

        return [
            ...$data,
            'project_document_id' => null,
            'file_path' => $file->store(
                $project ? "project-accounting/{$project->id}" : 'project-accounting/unassigned',
                'local',
            ),
            'file_name' => $file->getClientOriginalName(),
            'file_mime' => $file->getMimeType(),
            'file_size' => $file->getSize(),
        ];
    }

    private function withSelectedProjectDocument(Project $project, array $data): array
    {
        if (empty($data['project_document_id'])) {
            return $data;
        }

        $document = $project->documents()->find($data['project_document_id']);
        if (! $document) {
            throw ValidationException::withMessages(['project_document_id' => 'The selected file must belong to this project.']);
        }

        return [
            ...$data,
            'file_path' => $document->file_path,
            'file_name' => $document->file_name,
            'file_mime' => $document->file_mime,
            'file_size' => $document->file_size,
        ];
    }

    private function ensurePayableFitsInvoice(array $data, ?int $excludingTransactionId = null): void
    {
        if (
            $data['type'] !== 'payable'
            || empty($data['project_invoice_id'])
            || ! in_array($data['status'], ['ok_to_pay', 'paid'], true)
        ) {
            return;
        }

        $invoice = ProjectInvoice::query()->findOrFail($data['project_invoice_id']);
        $approvedQuery = $invoice->accountingTransactions()
            ->where('type', 'payable')
            ->whereIn('status', ['ok_to_pay', 'paid']);

        if ($excludingTransactionId !== null) {
            $approvedQuery->where('project_accounting_transactions.id', '!=', $excludingTransactionId);
        }

        $alreadyApplied = (float) $approvedQuery->sum('amount');
        $remaining = max(0, (float) $invoice->amount - $alreadyApplied);

        if (round((float) $data['amount'], 2) > round($remaining, 2)) {
            throw ValidationException::withMessages([
                'amount' => 'This payment exceeds the invoice balance of $'.number_format($remaining, 2).'.',
            ]);
        }
    }

    private function ensureReceivableFitsScheduledPayments(
        Project $project,
        array $data,
        array $scheduledPaymentIds,
        ?int $excludingTransactionId = null,
    ): void {
        if (
            $data['type'] !== 'receivable'
            || $data['status'] !== 'deposit'
            || $scheduledPaymentIds === []
        ) {
            return;
        }

        $schedules = $project->scheduledPayments()->get(['id', 'amount']);
        $balances = $schedules->mapWithKeys(
            fn (ScheduledPayment $payment): array => [$payment->id => (float) $payment->amount],
        )->all();
        $scheduleOrder = $schedules->pluck('id')->all();

        $approvedReceivables = $project->accountingTransactions()
            ->where('type', 'receivable')
            ->where('status', 'deposit')
            ->when(
                $excludingTransactionId !== null,
                fn ($query) => $query->where('id', '!=', $excludingTransactionId),
            )
            ->with('scheduledPayments:id')
            ->orderBy('id')
            ->get();

        foreach ($approvedReceivables as $receivable) {
            $remaining = (float) $receivable->amount;
            $linkedIds = $receivable->scheduledPayments->pluck('id')->all();

            foreach ($scheduleOrder as $scheduleId) {
                if ($remaining <= 0 || ! in_array($scheduleId, $linkedIds, true)) {
                    continue;
                }

                $applied = min($remaining, $balances[$scheduleId] ?? 0);
                $balances[$scheduleId] = max(0, ($balances[$scheduleId] ?? 0) - $applied);
                $remaining -= $applied;
            }
        }

        $available = array_sum(array_intersect_key($balances, array_flip($scheduledPaymentIds)));

        if (round((float) $data['amount'], 2) > round($available, 2)) {
            throw ValidationException::withMessages([
                'amount' => 'This receipt exceeds the selected scheduled payment balance of $'.number_format($available, 2).'.',
            ]);
        }
    }

    private function ensureScheduledTotalFitsContract(
        Project $project,
        float $submittedAmount,
        ?int $excludingScheduledPaymentId = null,
    ): void {
        $contractTotal = (float) $project->sales()->sum('amount');
        $scheduledQuery = $project->scheduledPayments();

        if ($excludingScheduledPaymentId !== null) {
            $scheduledQuery->where('id', '!=', $excludingScheduledPaymentId);
        }

        $scheduledTotal = (float) $scheduledQuery->sum('amount');

        if (round($scheduledTotal + $submittedAmount, 2) > round($contractTotal, 2)) {
            $remaining = max(0, $contractTotal - $scheduledTotal);

            throw ValidationException::withMessages([
                'amount' => 'The scheduled payments cannot exceed the contract total. Remaining available: $'.number_format($remaining, 2).'.',
            ]);
        }
    }

    private function ensureContractCoversScheduledPayments(Project $project, float $contractTotal): void
    {
        $scheduledTotal = (float) $project->scheduledPayments()->sum('amount');

        if (round($scheduledTotal, 2) > round($contractTotal, 2)) {
            throw ValidationException::withMessages([
                'amount' => 'The contract total cannot be reduced below the $'.number_format($scheduledTotal, 2).' already scheduled.',
            ]);
        }
    }

    private function ensureInvoiceBelongsToProject(Project $project, ProjectInvoice $invoice): void
    {
        abort_unless($invoice->project_id === $project->id, 404);
    }

    private function ensureAccountingLinksBelongToProject(Project $project, array $data, array $scheduledPaymentIds): void
    {
        if ($scheduledPaymentIds !== []) {
            $matchingSchedules = $project->scheduledPayments()->whereIn('id', $scheduledPaymentIds)->count();

            if ($matchingSchedules !== count($scheduledPaymentIds)) {
                throw ValidationException::withMessages([
                    'scheduled_payment_ids' => 'Every selected scheduled payment must belong to this project.',
                ]);
            }
        }

        if (! empty($data['project_invoice_id']) && ! $project->invoices()->whereKey($data['project_invoice_id'])->exists()) {
            throw ValidationException::withMessages([
                'project_invoice_id' => 'The selected vendor payment must belong to this project.',
            ]);
        }

        if (! empty($data['project_invoice_id']) && ! empty($data['contractor_id'])) {
            $invoiceMatchesContractor = $project->invoices()
                ->whereKey($data['project_invoice_id'])
                ->where('contractor_id', $data['contractor_id'])
                ->exists();

            if (! $invoiceMatchesContractor) {
                throw ValidationException::withMessages([
                    'project_invoice_id' => 'The selected invoice must belong to the selected contractor.',
                ]);
            }
        }
    }
}
