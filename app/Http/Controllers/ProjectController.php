<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProjectAccountingTransactionRequest;
use App\Http\Requests\ProjectInvoiceRequest;
use App\Http\Requests\ProjectInvoiceStatusRequest;
use App\Http\Requests\ProjectSaleRequest;
use App\Http\Requests\ScheduledPaymentRequest;
use App\Models\Contractor;
use App\Models\Manager;
use App\Models\Product;
use App\Models\Project;
use App\Models\ProjectAccountingTransaction;
use App\Models\ProjectInvoice;
use App\Models\ProjectSale;
use App\Models\ScheduledPayment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProjectController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('management/projects', [
            'projects' => Project::query()
                ->with([
                    'lead.company:com_id,company,prefix',
                    'lead.product:prod_id,product_name',
                    'lead.agent:agent_id,agent_name',
                    'lead.secondAgent:agent_id,agent_name',
                    'lead.salesmanOne:salesman_id,salesman_name',
                    'lead.salesmanTwo:salesman_id,salesman_name',
                    'lead.notes:id,lead_id,note_type,body,created_at',
                    'sales.product:prod_id,product_name',
                    'scheduledPayments',
                    'invoices.contractor:con_id,contractor',
                    'accountingTransactions.scheduledPayments',
                    'accountingTransactions.invoice.contractor:con_id,contractor',
                    'accountingTransactions.contractor:con_id,contractor',
                ])
                ->latest()
                ->get(),
            'products' => Product::query()->orderBy('product_name')->get(['prod_id', 'product_name']),
            'contractors' => Contractor::query()->orderBy('contractor')->get(['con_id', 'contractor']),
            'requesters' => Manager::query()->orderBy('manager_name')->pluck('manager_name')->values(),
            'currentRequester' => request()->user()?->manager?->manager_name ?: request()->user()?->username,
        ]);
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
                $project->lead()->update(['product_id' => $request->validated('product_id')]);
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

        $project->invoices()->create($data);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Vendor invoice added.']);

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

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Vendor invoice updated.']);

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

        DB::transaction(function () use ($project, $data, $scheduledPaymentIds): void {
            $transaction = $project->accountingTransactions()->create($data);
            $transaction->scheduledPayments()->sync($scheduledPaymentIds);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => ucfirst($data['type']).' added.']);

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

        Inertia::flash('toast', ['type' => 'success', 'message' => ucfirst($data['type']).' updated.']);

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
            return $project->lead()->value('customer_name');
        }

        return $contractorId ? Contractor::query()->whereKey($contractorId)->value('contractor') : null;
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
