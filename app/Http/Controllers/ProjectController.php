<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProjectAccountingTransactionRequest;
use App\Http\Requests\ProjectDetailsRequest;
use App\Http\Requests\ProjectInvoiceRequest;
use App\Http\Requests\ProjectInvoiceStatusRequest;
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
use App\Models\ProjectSale;
use App\Models\ScheduledPayment;
use App\Models\Salesman;
use App\Services\GoogleDriveProjectStorage;
use App\Services\ProjectNumberAllocator;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Carbon;
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
                    'accountingTransactions.scheduledPayments',
                    'accountingTransactions.invoice.contractor:con_id,contractor',
                    'accountingTransactions.contractor:con_id,contractor',
                    'company:com_id,company,prefix',
                    'product:prod_id,product_name',
                    'telemarketer:agent_id,agent_name',
                    'salesman:salesman_id,salesman_name,phone',
                    'manager:manager_id,manager_name',
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
                ->orderBy('salesman_name')
                ->get(['salesman_id', 'salesman_name', 'phone']),
            'managers' => Manager::query()
                ->orderBy('manager_name')
                ->get(['manager_id', 'manager_name']),
            'contractors' => Contractor::query()->orderBy('contractor')->get(['con_id', 'contractor']),
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
                    ? trim($data['project_number'])
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
        $project->sales()->create([
            ...$request->validated(),
            'type' => 'referral',
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Referral sale added.']);

        return back();
    }

    public function updateDetails(ProjectDetailsRequest $request, Project $project): RedirectResponse
    {
        $data = $request->validated();

        DB::transaction(function () use ($project, $data): void {
            $project->update([
                'project_number' => $data['project_number'],
                'status' => $data['status'],
            ]);
            $lead = $project->lead()->first();

            if (! $lead) {
                $project->update([
                    'company_id' => $data['company_id'],
                    'product_id' => $data['product_id'],
                    'customer_name' => $data['customer_name'],
                    'primary_number' => $data['primary_number'],
                    'mobile_number' => $data['mobile_number'] ?? null,
                    'email' => $data['email'] ?? null,
                    'address' => $data['address'],
                    'city' => $data['city'],
                    'state' => $data['state'],
                    'zip_code' => $data['zip_code'],
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
                'primary_number' => $data['primary_number'],
                'secondary_number' => $data['secondary_number'] ?? null,
                'mobile_number' => $data['mobile_number'] ?? null,
                'email' => $data['email'] ?? null,
                'address' => $data['address'],
                'city' => $data['city'],
                'state' => $data['state'],
                'zip_code' => $data['zip_code'],
                'source' => $data['source'],
                'appointment_at' => $data['appointment_at'] ?? null,
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
            $sale->update($request->validated());

            if ($sale->type === 'original') {
                $project->update(['amount' => $request->validated('amount')]);
                if ($project->lead_id) {
                    $project->lead()->update(['product_id' => $request->validated('product_id')]);
                } else {
                    $project->update(['product_id' => $request->validated('product_id')]);
                }
            }
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => ucfirst($sale->type).' sale updated.']);

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

        if ($file = $request->file('file')) {
            $data = [
                ...$data,
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

        Inertia::flash('toast', $this->driveSyncToast('Vendor invoice added.', $driveSync));

        return back();
    }

    public function updateInvoice(
        ProjectInvoiceRequest $request,
        Project $project,
        ProjectInvoice $invoice,
    ): RedirectResponse {
        $this->ensureInvoiceBelongsToProject($project, $invoice);
        $data = $request->safe()->except(['file']);
        $oldFilePath = $invoice->file_path;

        if ($file = $request->file('file')) {
            $data = [
                ...$data,
                'file_path' => $file->store("project-invoices/{$project->id}", 'local'),
                'file_name' => $file->getClientOriginalName(),
                'file_mime' => $file->getMimeType(),
                'file_size' => $file->getSize(),
            ];
        }

        $invoice->update($data);

        if ($request->hasFile('file') && $oldFilePath) {
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

        Inertia::flash('toast', $this->driveSyncToast('Vendor invoice updated.', $driveSync));

        return back();
    }

    public function updateInvoiceStatus(
        ProjectInvoiceStatusRequest $request,
        Project $project,
        ProjectInvoice $invoice,
    ): RedirectResponse {
        $this->ensureInvoiceBelongsToProject($project, $invoice);
        $invoice->update($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Invoice status updated.']);

        return back();
    }

    public function destroyInvoice(Project $project, ProjectInvoice $invoice): RedirectResponse
    {
        $this->ensureInvoiceBelongsToProject($project, $invoice);
        $filePath = $invoice->file_path;
        $invoice->delete();

        if ($filePath) {
            Storage::disk('local')->delete($filePath);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Vendor invoice deleted.']);

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

    public function storeAccountingTransaction(
        ProjectAccountingTransactionRequest $request,
        Project $project,
    ): RedirectResponse {
        $data = $request->safe()->except(['scheduled_payment_ids', 'file']);
        $scheduledPaymentIds = $data['type'] === 'receivable' ? $request->input('scheduled_payment_ids', []) : [];
        $data['project_invoice_id'] = $data['type'] === 'payable' ? ($data['project_invoice_id'] ?? null) : null;
        $data['contractor_id'] = $data['type'] === 'payable' ? ($data['contractor_id'] ?? null) : null;
        $data['counterparty'] = $this->accountingCounterparty($project, $data['type'], $data['contractor_id']);
        $data['requested_by'] = ($data['requested_by'] ?? null) ?: ($request->user()?->manager?->manager_name ?: $request->user()?->username);
        $this->ensureAccountingLinksBelongToProject($project, $data, $scheduledPaymentIds);
        $this->ensureReceivableFitsScheduledPayments($project, $data, $scheduledPaymentIds);
        $this->ensurePayableFitsInvoice($data);
        $data = $this->withAccountingFile($request, $project, $data);

        $transaction = DB::transaction(function () use ($project, $data, $scheduledPaymentIds): ProjectAccountingTransaction {
            $transaction = $project->accountingTransactions()->create($data);
            $transaction->scheduledPayments()->sync($scheduledPaymentIds);

            return $transaction;
        });

        $driveSync = $this->mirrorProjectFile(
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
        $scheduledPaymentIds = $data['type'] === 'receivable' ? $request->input('scheduled_payment_ids', []) : [];
        $data['project_invoice_id'] = $data['type'] === 'payable' ? ($data['project_invoice_id'] ?? null) : null;
        $data['contractor_id'] = $data['type'] === 'payable' ? ($data['contractor_id'] ?? null) : null;
        $data['counterparty'] = $this->accountingCounterparty($project, $data['type'], $data['contractor_id']);
        $data['requested_by'] = ($data['requested_by'] ?? null) ?: $accountingTransaction->requested_by ?: ($request->user()?->manager?->manager_name ?: $request->user()?->username);
        $oldFilePath = $accountingTransaction->file_path;
        $this->ensureAccountingLinksBelongToProject($project, $data, $scheduledPaymentIds);
        $this->ensureReceivableFitsScheduledPayments($project, $data, $scheduledPaymentIds, $accountingTransaction->id);
        $this->ensurePayableFitsInvoice($data, $accountingTransaction->id);
        $data = $this->withAccountingFile($request, $project, $data);

        DB::transaction(function () use ($accountingTransaction, $data, $scheduledPaymentIds): void {
            $accountingTransaction->update($data);
            $accountingTransaction->scheduledPayments()->sync($scheduledPaymentIds);
        });

        if ($request->hasFile('file') && $oldFilePath) {
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
        $accountingTransaction->delete();

        if ($filePath) {
            Storage::disk('local')->delete($filePath);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Accounting transaction deleted.']);

        return back();
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

    private function accountingCounterparty(Project $project, string $type, ?int $contractorId): ?string
    {
        if ($type === 'receivable') {
            return $project->lead()->value('customer_name') ?: $project->customer_name;
        }

        return $contractorId ? Contractor::query()->whereKey($contractorId)->value('contractor') : null;
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
        Project $project,
        array $data,
    ): array {
        if (! $file = $request->file('file')) {
            return $data;
        }

        return [
            ...$data,
            'file_path' => $file->store("project-accounting/{$project->id}", 'local'),
            'file_name' => $file->getClientOriginalName(),
            'file_mime' => $file->getMimeType(),
            'file_size' => $file->getSize(),
        ];
    }

    private function ensurePayableFitsInvoice(array $data, ?int $excludingTransactionId = null): void
    {
        if ($data['type'] !== 'payable' || ! in_array($data['status'], ['ok_to_pay', 'paid'], true)) {
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
            || ! in_array($data['status'], ['ok_to_pay', 'paid'], true)
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
            ->whereIn('status', ['ok_to_pay', 'paid'])
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
                'project_invoice_id' => 'The selected vendor invoice must belong to this project.',
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
