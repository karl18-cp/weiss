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
use App\Models\ProjectPaymentCheck;
use App\Models\ProjectSale;
use App\Models\Salesman;
use App\Models\Vendor;
use App\Models\ScheduledPayment;
use App\Services\GoogleDriveProjectStorage;
use App\Services\ProjectNumberAllocator;
use App\Services\ProjectCommissionCalculator;
use Dompdf\Dompdf;
use Dompdf\Options;
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
    public function __construct(
        private readonly GoogleDriveProjectStorage $googleDrive,
        private readonly ProjectCommissionCalculator $commissions,
    ) {}

    public function printCoverPage(Project $project): \Illuminate\Http\Response
    {
        $project->loadMissing([
            'lead.company',
            'lead.product',
            'lead.salesmanOne',
            'lead.salesmanTwo',
            'lead.notes',
            'sales.product',
            'sales.salesman',
            'accountingTransactions',
            'invoices.contractor',
            'invoices.vendor',
            'contractors',
            'company',
            'product',
            'telemarketer',
            'salesman',
            'manager',
        ]);
        $this->hydrateStandaloneProject($project);

        $income = (float) $project->accountingTransactions
            ->where('type', 'receivable')
            ->sum('amount');
        $expenses = (float) $project->accountingTransactions
            ->where('type', 'payable')
            ->sum('amount');
        $saleAmount = (float) ($project->sales->sum('amount') ?: $project->amount);
        $dateSold = $project->sales->sortBy('sale_date')->first()?->sale_date;
        $salesRepresentatives = collect([
            $project->salesman?->salesman_name,
            $project->lead?->salesmanOne?->salesman_name,
            $project->lead?->salesmanTwo?->salesman_name,
            ...$project->sales->pluck('salesman.salesman_name')->all(),
        ])->filter()->unique()->join(', ');

        $invoiceRows = $project->invoices
            ->groupBy(fn (ProjectInvoice $invoice): string => strtolower(trim(
                $invoice->contractor?->contractor
                    ?? $invoice->vendor?->vendor
                    ?? 'Unassigned',
            )))
            ->map(function ($invoices): array {
                /** @var ProjectInvoice $first */
                $first = $invoices->first();

                return [
                    'contractor' => $first->contractor?->contractor ?? $first->vendor?->vendor ?? 'Unassigned',
                    'date' => $invoices->sortByDesc('invoice_date')->first()?->invoice_date,
                    'bid' => (float) $invoices->sum('amount'),
                    'note' => $invoices->pluck('notes')->filter()->unique()->join('; '),
                ];
            })
            ->values();
        $invoicedContractors = $invoiceRows->pluck('contractor')
            ->filter()
            ->map(fn (string $name): string => strtolower(trim($name)))
            ->all();
        $contractorRows = $invoiceRows->concat(
            $project->contractors
                ->reject(fn (Contractor $contractor): bool => in_array(strtolower(trim($contractor->contractor)), $invoicedContractors, true))
                ->map(fn (Contractor $contractor): array => [
                    'contractor' => $contractor->contractor,
                    'date' => null,
                    'bid' => null,
                    'note' => null,
                ]),
        )->take(10)->values();

        $options = new Options();
        $options->set('isRemoteEnabled', false);
        $dompdf = new Dompdf($options);
        $dompdf->loadHtml(view('pdf.project-cover-page', [
            'project' => $project,
            'income' => $income,
            'expenses' => $expenses,
            'profitLoss' => $income - $expenses,
            'saleAmount' => $saleAmount,
            'finance' => max(0, $saleAmount - $income),
            'dateSold' => $dateSold,
            'salesRepresentatives' => $salesRepresentatives,
            'contractorRows' => $contractorRows,
        ])->render());
        $dompdf->setPaper('letter', 'portrait');
        $dompdf->render();

        $fileName = preg_replace('/[^A-Za-z0-9._-]+/', '-', $project->project_number ?: "project-{$project->id}").'-cover-page.pdf';

        return response($dompdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$fileName.'"',
        ]);
    }

    public function exportAccounting(Project $project, string $type): \Illuminate\Http\Response
    {
        abort_unless(in_array($type, ['receivable', 'payable'], true), 404);
        $project->loadMissing([
            'lead.company',
            'sales',
            'accountingTransactions.contractor',
            'accountingTransactions.vendor',
            'accountingTransactions.salesman',
            'accountingTransactions.company',
            'accountingTransactions.invoice',
        ]);
        $transactions = $project->accountingTransactions
            ->where('type', $type)
            ->sortBy([['transaction_date', 'asc'], ['id', 'asc']])
            ->values();
        $income = (float) $project->accountingTransactions->where('type', 'receivable')->sum('amount');
        $expenses = (float) $project->accountingTransactions->where('type', 'payable')->sum('amount');
        $saleAmount = (float) ($project->sales->sum('amount') ?: $project->amount);
        $label = $type === 'payable' ? 'payables' : 'receivables';
        $fileName = preg_replace('/[^A-Za-z0-9._-]+/', '-', $project->project_number ?: "project-{$project->id}").'-'.$label.'.pdf';

        $options = new Options();
        $options->set('isRemoteEnabled', false);
        $dompdf = new Dompdf($options);
        $dompdf->loadHtml(view('pdf.project-accounting', [
            'project' => $project,
            'type' => $type,
            'transactions' => $transactions,
            'income' => $income,
            'expenses' => $expenses,
            'saleAmount' => $saleAmount,
        ])->render());
        $dompdf->setPaper('letter', 'portrait');
        $dompdf->render();

        return response($dompdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$fileName.'"',
        ]);
    }

    public function exportCompletionForm(Request $request, Project $project): \Illuminate\Http\Response
    {
        $data = $request->validate([
            'audience' => ['required', 'in:office,salesman'],
            'salesman_id' => ['nullable', 'integer', 'exists:salesmen,salesman_id'],
        ]);
        $project->loadMissing([
            'lead.company', 'lead.product', 'lead.salesmanOne', 'lead.salesmanTwo',
            'sales', 'sales.salesman', 'accountingTransactions', 'company', 'product',
            'salesman', 'manager',
        ]);
        $this->hydrateStandaloneProject($project);
        $salesmen = collect([
            $project->salesman,
            $project->lead?->salesmanOne,
            $project->lead?->salesmanTwo,
            ...$project->sales->pluck('salesman')->all(),
        ])->filter()->unique('salesman_id')->values();

        $salesman = null;
        $salesmanTotals = null;
        if ($data['audience'] === 'salesman') {
            $salesman = $salesmen->firstWhere('salesman_id', (int) ($data['salesman_id'] ?? 0));
            abort_unless($salesman instanceof Salesman, 422, 'Select a salesman assigned to this project.');
            $salesmanTotals = $this->commissions->calculate($project, $salesman);
        }

        $receivables = (float) $project->accountingTransactions->where('type', 'receivable')->sum('amount');
        $payables = $project->accountingTransactions->where('type', 'payable');
        $expenses = (float) $payables
            ->reject(fn ($transaction): bool => str_contains(strtolower((string) $transaction->category), 'commission'))
            ->sum('amount');
        $commissionPaid = (float) $payables
            ->filter(fn ($transaction): bool => str_contains(strtolower((string) $transaction->category), 'commission'))
            ->where('status', 'paid')->sum('amount');
        $saleAmount = (float) ($project->sales->sum('amount') ?: $project->amount);

        $options = new Options();
        $options->set('isRemoteEnabled', false);
        $dompdf = new Dompdf($options);
        $dompdf->loadHtml(view('pdf.project-completion-form', [
            'project' => $project,
            'audience' => $data['audience'],
            'salesman' => $salesman,
            'salesmanTotals' => $salesmanTotals,
            'officeTotals' => [
                'sale_amount' => $saleAmount,
                'receivables' => $receivables,
                'balance' => $saleAmount - $receivables,
                'expenses' => $expenses,
                'commission_paid' => $commissionPaid,
                'net' => $receivables - $expenses - $commissionPaid,
            ],
        ])->render());
        $dompdf->setPaper('letter', 'portrait');
        $dompdf->render();

        $suffix = $data['audience'] === 'office' ? 'office' : 'salesman-'.($salesman?->salesman_id ?? 'copy');
        $fileName = preg_replace('/[^A-Za-z0-9._-]+/', '-', $project->project_number ?: "project-{$project->id}")."-completion-{$suffix}.pdf";

        return response($dompdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$fileName.'"',
        ]);
    }

    public function commissionBreakdown(Project $project): \Illuminate\Http\JsonResponse
    {
        $project->loadMissing([
            'sales',
            'sales.salesman',
            'accountingTransactions',
            'salesman',
            'lead.salesmanOne',
            'lead.salesmanTwo',
        ]);
        $salesmen = collect([
            $project->salesman,
            $project->lead?->salesmanOne,
            $project->lead?->salesmanTwo,
            ...$project->sales->pluck('salesman')->all(),
        ])->filter()->unique('salesman_id')->values();
        $rows = $salesmen->map(fn (Salesman $salesman): array => [
            'salesman_id' => $salesman->salesman_id,
            'salesman_name' => $salesman->salesman_name,
            ...$this->commissions->calculate($project, $salesman),
        ]);
        $totalSale = (float) ($project->sales->sum('amount') ?: $project->amount);
        $received = (float) $project->accountingTransactions
            ->where('type', 'receivable')->sum('amount');
        $expenses = (float) $project->accountingTransactions
            ->where('type', 'payable')
            ->reject(fn ($transaction): bool => str_contains(strtolower((string) $transaction->category), 'commission'))
            ->sum('amount');
        $referralOnlySalesmanIds = $project->sales->where('type', 'referral')->pluck('salesman_id')
            ->filter()->map(fn ($id): int => (int) $id)->unique();
        $originalSalesmanIds = collect([$project->salesman_id, $project->lead?->salesman_1_id, $project->lead?->salesman_2_id])
            ->filter(fn ($id): bool => ! $referralOnlySalesmanIds->contains((int) $id))
            ->filter()->map(fn ($id): int => (int) $id)->unique();
        $leadCosts = (float) $rows->whereIn('salesman_id', $originalSalesmanIds)
            ->sum(fn (array $row): float => (float) $row['lead_cost'] + (float) $row['change_order_lead_cost']);
        $commissionPaid = (float) $rows->sum('commission_paid');
        $totalCommission = (float) $rows->sum('commission_due');

        return response()->json([
            'project_id' => $project->id,
            'project_number' => $project->project_number,
            'accounting' => [
                'sale_amount' => round($totalSale, 2),
                'received_commissionable' => round($received, 2),
                'project_balance' => round($totalSale - $received, 2),
                'lead_cost' => round($leadCosts, 2),
                'expenses_commissionable' => round($expenses, 2),
                'total_commission' => round($totalCommission, 2),
                'total_commission_paid' => round($commissionPaid, 2),
                'profit_net' => round($received - $expenses - $leadCosts - $totalCommission, 2),
            ],
            'salesmen' => $rows,
        ]);
    }

    public function index(): Response
    {
        $selectedProjectId = request()->integer('project');
        $selectedLeadId = $selectedProjectId > 0
            ? (int) Project::query()->whereKey($selectedProjectId)->value('lead_id')
            : 0;

        $projects = Project::query()
            ->with([
                'lead.company:com_id,company,prefix',
                'lead.product:prod_id,product_name',
                'lead.agent:agent_id,agent_name',
                'lead.secondAgent:agent_id,agent_name',
                'lead.salesmanOne:salesman_id,salesman_name,phone',
                'lead.salesmanTwo:salesman_id,salesman_name,phone',
                'lead.notes' => fn ($query) => $selectedLeadId > 0
                    ? $query->where('lead_id', $selectedLeadId)
                    : $query->whereRaw('1 = 0'),
                'sales.product:prod_id,product_name',
                'sales.salesman:salesman_id,salesman_name',
                'scheduledPayments' => fn ($query) => $selectedProjectId > 0
                    ? $query->where('project_id', $selectedProjectId)
                    : $query->whereRaw('1 = 0'),
                'invoices.contractor:con_id,contractor',
                'invoices.vendor:vendor_id,vendor',
                'accountingTransactions' => fn ($query) => $query->select([
                    'id', 'project_id', 'type', 'category', 'transaction_date',
                    'reference_number', 'counterparty', 'amount', 'status', 'qb',
                ]),
                'documents' => fn ($query) => $selectedProjectId > 0
                    ? $query->where('project_id', $selectedProjectId)
                        ->select(['id', 'project_id', 'project_invoice_id', 'project_accounting_transaction_id', 'project_sale_id', 'category', 'file_name', 'file_mime', 'file_size', 'created_at'])
                    : $query->whereRaw('1 = 0'),
                'paymentChecks' => fn ($query) => $selectedProjectId > 0
                    ? $query->where('project_id', $selectedProjectId)
                        ->select(['id', 'project_id', 'type', 'amount', 'file_name', 'file_mime', 'file_size', 'paid_at'])
                    : $query->whereRaw('1 = 0'),
                'activityLogs' => fn ($query) => $selectedProjectId > 0
                    ? $query->where('project_id', $selectedProjectId)
                    : $query->whereRaw('1 = 0'),
                'activityLogs.actor:acc_id,username',
                'company:com_id,company,prefix',
                'product:prod_id,product_name',
                'telemarketer:agent_id,agent_name',
                'salesman:salesman_id,salesman_name,phone',
                'manager:manager_id,manager_name',
                'contractors' => fn ($query) => $selectedProjectId > 0
                    ? $query->wherePivot('project_id', $selectedProjectId)
                        ->select(['contractors.con_id', 'contractor'])
                    : $query->whereRaw('1 = 0'),
            ])
            ->latest()
            ->get()
            ->each(fn (Project $project) => $this->hydrateStandaloneProject($project));

        if ($selectedProject = $projects->firstWhere('id', $selectedProjectId)) {
            $selectedProject->load([
                'accountingTransactions.scheduledPayments',
                'accountingTransactions.invoice.contractor:con_id,contractor',
                'accountingTransactions.invoice.vendor:vendor_id,vendor',
                'accountingTransactions.contractor:con_id,contractor',
                'accountingTransactions.vendor:vendor_id,vendor',
                'accountingTransactions.salesman:salesman_id,salesman_name',
                'accountingTransactions.company:com_id,company,prefix',
            ]);
        }

        return Inertia::render('management/projects', [
            'projects' => $projects,
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

    public function storeCustomerProject(Request $request, Project $project, ProjectNumberAllocator $projectNumbers): RedirectResponse
    {
        abort_if($project->lead_id === null, 422, 'A customer-linked project is required.');

        $data = $request->validate([
            'company_id' => ['required', 'integer', 'exists:companies,com_id'],
            'product_id' => ['required', 'integer', 'exists:products,prod_id'],
            'appointment_at' => ['required', 'date'],
            'salesman_1_id' => ['nullable', 'integer', 'exists:salesmen,salesman_id'],
            'salesman_2_id' => ['nullable', 'integer', 'different:salesman_1_id', 'exists:salesmen,salesman_id'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:9999999999.99'],
            'notes' => ['nullable', 'string', 'max:10000'],
        ]);

        $sourceLead = $project->lead()->firstOrFail();
        $familyId = (int) ($sourceLead->project_family_id ?: $sourceLead->id);

        $newProject = DB::transaction(function () use ($request, $project, $sourceLead, $familyId, $data, $projectNumbers): Project {
            $newLead = $sourceLead->replicate([
                'calltools_contact_id',
                'primary_phone_normalized',
                'rehash_at',
                'duplicate_of_id',
                'project_family_id',
            ]);
            $newLead->forceFill([
                'project_family_id' => $familyId,
                'company_id' => $data['company_id'],
                'product_id' => $data['product_id'],
                'appointment_at' => $data['appointment_at'],
                'salesman_1_id' => $data['salesman_1_id'] ?? null,
                'salesman_2_id' => $data['salesman_2_id'] ?? null,
                'telemarketer_notes' => (string) ($data['notes'] ?? ''),
                'status' => 'sold',
                'created_by' => $request->user()->getAuthIdentifier(),
            ])->save();

            $newProject = Project::query()->create([
                'lead_id' => $newLead->id,
                'project_number' => $projectNumbers->allocateChild($project),
                'amount' => $data['amount'],
                'status' => 'new',
                'created_by' => $request->user()->getAuthIdentifier(),
            ]);

            $newProject->sales()->create([
                'type' => 'original',
                'amount' => $data['amount'],
                'sale_date' => Carbon::parse($data['appointment_at'])->toDateString(),
                'product_id' => $data['product_id'],
            ]);

            return $newProject;
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'A new project was added for this customer.']);

        return to_route('management.projects', ['project' => $newProject->id, 'tab' => 'DTL']);
    }

    public function destroy(Project $project): RedirectResponse
    {
        abort_if($project->lead_id === null, 422, 'Only an additional customer project can be deleted here.');

        $lead = $project->lead()->firstOrFail();
        $familyId = (int) ($lead->project_family_id ?: $lead->id);
        $familyLeadIds = Lead::query()
            ->whereKey($familyId)
            ->orWhere('project_family_id', $familyId)
            ->pluck('id');
        $rootProjectId = Project::query()
            ->whereIn('lead_id', $familyLeadIds)
            ->orderByRaw('CASE WHEN lead_id = ? THEN 0 ELSE 1 END', [$familyId])
            ->orderBy('id')
            ->value('id');

        abort_if((int) $rootProjectId === $project->id, 422, 'The customer’s original project is protected and cannot be deleted.');

        $project->loadMissing(['documents', 'invoices', 'accountingTransactions']);
        $attachments = collect([
            $project->contract_file_path ? [
                'path' => $project->contract_file_path,
                'name' => $project->contract_file_name ?: basename($project->contract_file_path),
            ] : null,
            ...$project->documents->map(fn (ProjectDocument $document) => [
                'path' => $document->file_path,
                'name' => $document->file_name,
            ])->all(),
            ...$project->invoices->whereNull('project_document_id')->filter(fn (ProjectInvoice $invoice) => filled($invoice->file_path))->map(fn (ProjectInvoice $invoice) => [
                'path' => $invoice->file_path,
                'name' => $invoice->file_name ?: basename($invoice->file_path),
            ])->all(),
            ...$project->accountingTransactions->whereNull('project_document_id')->filter(fn (ProjectAccountingTransaction $transaction) => filled($transaction->file_path))->map(fn (ProjectAccountingTransaction $transaction) => [
                'path' => $transaction->file_path,
                'name' => $transaction->file_name ?: basename($transaction->file_path),
            ])->all(),
        ])->filter()->unique('path');

        foreach ($attachments as $attachment) {
            $this->deleteProjectAttachment($project, $attachment['path'], $attachment['name']);
        }

        DB::transaction(function () use ($project, $lead): void {
            $project->delete();
            $lead->delete();
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Additional customer project deleted.']);

        return to_route('management.projects');
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

    public function storeReferral(
        ProjectSaleRequest $request,
        Project $project,
        ProjectNumberAllocator $projectNumbers,
    ): RedirectResponse
    {
        $salesmanId = $request->validated('salesman_id');
        $this->ensureReferralSalesmanIsSecondary($project, $salesmanId);

        if ($request->validated('destination') === 'new_project') {
            abort_if($project->lead_id === null, 422, 'A customer-linked project is required to create another project number.');

            $sourceLead = $project->lead()->firstOrFail();
            $familyId = (int) ($sourceLead->project_family_id ?: $sourceLead->id);
            $companyId = (int) $sourceLead->company_id;

            [$newProject, $sale] = DB::transaction(function () use (
                $request,
                $project,
                $sourceLead,
                $familyId,
                $companyId,
                $salesmanId,
                $projectNumbers,
            ): array {
                $newLead = $sourceLead->replicate([
                    'calltools_contact_id',
                    'primary_phone_normalized',
                    'rehash_at',
                    'duplicate_of_id',
                    'project_family_id',
                ]);
                $newLead->forceFill([
                    'project_family_id' => $familyId,
                    'product_id' => $request->validated('product_id') ?: $sourceLead->product_id,
                    'appointment_at' => Carbon::parse($request->validated('sale_date'))->setTime(12, 0),
                    'salesman_1_id' => $sourceLead->salesman_1_id,
                    'salesman_2_id' => $salesmanId,
                    'status' => 'sold',
                    'created_by' => $request->user()->getAuthIdentifier(),
                ])->save();

                $newProject = Project::query()->create([
                    'lead_id' => $newLead->id,
                    'project_number' => $projectNumbers->allocateChild($project),
                    'amount' => $request->validated('amount'),
                    'status' => 'new',
                    'created_by' => $request->user()->getAuthIdentifier(),
                ]);

                $sale = $newProject->sales()->create([
                    ...$request->safe()->except('files', 'destination', 'project_number'),
                    'type' => 'referral',
                ]);

                return [$newProject, $sale];
            });

            $driveFailures = $this->storeSaleDocuments($request, $newProject, $sale);
            Inertia::flash('toast', $this->driveSyncToast(
                'Referral sale created under a separate project number.',
                $driveFailures === 0,
            ));

            return to_route('management.projects', ['project' => $newProject->id, 'tab' => 'DTL']);
        }

        $sale = DB::transaction(function () use ($request, $project): ProjectSale {
            $lockedProject = Project::query()->lockForUpdate()->findOrFail($project->id);
            $prospectiveContractTotal = (float) $lockedProject->sales()->sum('amount')
                + (float) $request->validated('amount');
            $this->ensureContractCoversScheduledPayments($lockedProject, $prospectiveContractTotal);

            return $lockedProject->sales()->create([
                ...$request->safe()->except('files', 'destination', 'project_number'),
                'type' => 'referral',
            ]);
        });

        $driveFailures = $this->storeSaleDocuments($request, $project, $sale);

        $label = (float) $sale->amount < 0 ? 'Discount added.' : 'Referral sale added.';
        Inertia::flash('toast', $this->driveSyncToast($label, $driveFailures === 0));

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
        if ($sale->type === 'referral') {
            $this->ensureReferralSalesmanIsSecondary($project, $request->validated('salesman_id'));
        }

        DB::transaction(function () use ($request, $project, $sale): void {
            $lockedProject = Project::query()->lockForUpdate()->findOrFail($project->id);
            $prospectiveContractTotal = (float) $lockedProject->sales()->sum('amount')
                - (float) $sale->amount
                + (float) $request->validated('amount');
            $this->ensureContractCoversScheduledPayments($lockedProject, $prospectiveContractTotal);
            $saleData = $request->safe()->except('files');
            if ($sale->type === 'original') {
                $saleData['salesman_id'] = null;
            }
            $sale->update($saleData);

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

    public function destroyInvoiceFile(Project $project, ProjectInvoice $invoice): RedirectResponse
    {
        abort_unless($invoice->project_id === $project->id && $invoice->file_name, 404);
        $driveDeleted = $this->deleteProjectAttachment($project, $invoice->file_path, $invoice->file_name, $invoice->project_document_id);
        $invoice->update([
            'project_document_id' => null,
            'file_path' => null,
            'file_name' => null,
            'file_mime' => null,
            'file_size' => null,
        ]);

        Inertia::flash('toast', $this->driveDeletionToast('Invoice file removed from the CRM.', $driveDeleted));

        return back();
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
            $data['company_id'] = $data['company_id'] ?? $project->lead?->company_id ?? $project->company_id;
            $data = $this->withSelectedProjectDocument($project, $data);
        }
        $data['contractor_id'] = $data['type'] === 'payable' ? ($data['contractor_id'] ?? null) : null;
        $data['vendor_id'] = $data['type'] === 'payable' ? ($data['vendor_id'] ?? null) : null;
        if ($data['type'] === 'payable' && $data['status'] !== 'paid') {
            $data['payment_method'] = null;
            $data['reference_number'] = null;
        }
        $data['counterparty'] = $unassigned && $data['type'] === 'receivable'
            ? ($data['counterparty'] ?? null)
            : $this->accountingCounterparty($project, $data['type'], $data['contractor_id'], $data['vendor_id'], $data['project_invoice_id'], $data['salesman_id'] ?? null);
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
        $data['vendor_id'] = $data['type'] === 'payable' ? ($data['vendor_id'] ?? null) : null;
        if ($data['type'] === 'payable' && $data['status'] !== 'paid') {
            $data['payment_method'] = null;
            $data['reference_number'] = null;
        }
        $data['counterparty'] = $this->accountingCounterparty($project, $data['type'], $data['contractor_id'], $data['vendor_id'], $data['project_invoice_id'], $data['salesman_id'] ?? null);
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

    public function storePaymentCheck(Request $request, Project $project, string $type): RedirectResponse
    {
        abort_unless(in_array($type, ['lead_cost', 'commission'], true), 404);

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0', 'max:9999999999.99'],
            'check_file' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,webp,heic,heif', 'max:20480'],
        ]);
        $paymentCheck = $project->paymentChecks()->firstOrNew(['type' => $type]);
        $oldFilePath = $paymentCheck->file_path;
        $uploadedFile = $request->file('check_file');

        $paymentCheck->amount = $data['amount'];
        if ($uploadedFile) {
            $paymentCheck->file_path = $uploadedFile->store("project-payment-checks/{$project->id}", 'local');
            $paymentCheck->file_name = $uploadedFile->getClientOriginalName();
            $paymentCheck->file_mime = $uploadedFile->getMimeType();
            $paymentCheck->file_size = $uploadedFile->getSize();
            $paymentCheck->paid_at = now();
        }
        $paymentCheck->save();

        if ($uploadedFile && $oldFilePath && $oldFilePath !== $paymentCheck->file_path) {
            Storage::disk('local')->delete($oldFilePath);
        }

        $driveSync = $uploadedFile
            ? $this->mirrorProjectFile($project, $paymentCheck->file_path, $paymentCheck->file_name, $paymentCheck->file_mime)
            : null;
        $label = $type === 'lead_cost' ? 'Lead cost' : 'Commission';
        Inertia::flash('toast', $this->driveSyncToast("{$label} tracking updated.", $driveSync));

        return back();
    }

    public function showPaymentCheckFile(Project $project, ProjectPaymentCheck $paymentCheck): StreamedResponse
    {
        abort_unless(
            $paymentCheck->project_id === $project->id
            && $paymentCheck->file_path
            && Storage::disk('local')->exists($paymentCheck->file_path),
            404,
        );

        return Storage::disk('local')->response(
            $paymentCheck->file_path,
            $paymentCheck->file_name,
            ['Content-Disposition' => 'inline'],
        );
    }

    public function destroyPaymentCheckFile(Project $project, ProjectPaymentCheck $paymentCheck): RedirectResponse
    {
        abort_unless($paymentCheck->project_id === $project->id, 404);

        if ($paymentCheck->file_path) {
            Storage::disk('local')->delete($paymentCheck->file_path);
        }
        $paymentCheck->update([
            'file_path' => null,
            'file_name' => null,
            'file_mime' => null,
            'file_size' => null,
            'paid_at' => null,
        ]);
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Check removed and status changed to pending.']);

        return back();
    }

    public function destroyProjectDocument(Project $project, ProjectDocument $document): RedirectResponse
    {
        abort_unless($document->project_id === $project->id, 404);
        $driveDeleted = $this->deleteProjectAttachment($project, $document->file_path, $document->file_name);

        ProjectInvoice::query()->where('project_document_id', $document->id)->update([
            'project_document_id' => null,
            'file_path' => null,
            'file_name' => null,
            'file_mime' => null,
            'file_size' => null,
        ]);
        ProjectAccountingTransaction::query()->where('project_document_id', $document->id)->update([
            'project_document_id' => null,
            'file_path' => null,
            'file_name' => null,
            'file_mime' => null,
            'file_size' => null,
        ]);
        $document->delete();

        Inertia::flash('toast', $this->driveDeletionToast('File removed from the CRM.', $driveDeleted));

        return back();
    }

    public function storeProjectDocuments(
        Request $request,
        Project $project,
        GoogleDriveProjectStorage $drive,
    ): RedirectResponse {
        $data = $request->validate([
            'files' => ['required', 'array', 'min:1', 'max:20'],
            // Validate the safe extension instead of relying on the server's MIME
            // detector. Phone photos (especially HEIC/JFIF) are commonly reported
            // as application/octet-stream even though they are valid uploads.
            'files.*' => ['required', 'file', 'extensions:pdf,jpg,jpeg,jfif,png,webp,heic,heif', 'max:20480'],
            'target_type' => ['required', 'in:project,invoice,accounting,sale,completion'],
            'target_id' => ['nullable', 'integer'],
            'completion_audience' => ['nullable', 'required_if:target_type,completion', 'in:office,salesman'],
            'completion_salesman_id' => ['nullable', 'integer', 'exists:salesmen,salesman_id'],
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

        $category = $data['target_type'] === 'completion'
            ? 'Completion Form - '.($data['completion_audience'] === 'office'
                ? 'Office'
                : 'Salesman'.(! empty($data['completion_salesman_id']) ? ' #'.$data['completion_salesman_id'] : ''))
            : ($sale
            ? 'Sale Contract'
            : ($invoice
            ? 'Invoice'
            : ($transaction
                ? ($transaction->type === 'receivable' ? 'Receivable' : 'Payable')
                : 'Project Upload')));
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

    public function destroyAccountingTransactionFile(
        Project $project,
        ProjectAccountingTransaction $accountingTransaction,
    ): RedirectResponse {
        abort_unless($accountingTransaction->project_id === $project->id && $accountingTransaction->file_name, 404);
        $driveDeleted = $this->deleteProjectAttachment(
            $project,
            $accountingTransaction->file_path,
            $accountingTransaction->file_name,
            $accountingTransaction->project_document_id,
        );
        $accountingTransaction->update([
            'project_document_id' => null,
            'file_path' => null,
            'file_name' => null,
            'file_mime' => null,
            'file_size' => null,
        ]);

        Inertia::flash('toast', $this->driveDeletionToast('Accounting file removed from the CRM.', $driveDeleted));

        return back();
    }

    private function deleteProjectAttachment(
        Project $project,
        ?string $filePath,
        string $fileName,
        ?int $projectDocumentId = null,
    ): ?bool {
        $driveDeleted = null;

        if ($this->googleDrive->configured()) {
            try {
                $this->googleDrive->deleteMirroredFile($project, $fileName);
                $driveDeleted = true;
            } catch (Throwable $exception) {
                $driveDeleted = false;
                Log::warning('Google Drive project file deletion failed.', [
                    'project_id' => $project->id,
                    'file_name' => $fileName,
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        if ($filePath && ! $projectDocumentId) {
            Storage::disk('local')->delete($filePath);
        }

        return $driveDeleted;
    }

    private function accountingCounterparty(
        Project $project,
        string $type,
        ?int $contractorId,
        ?int $vendorId,
        ?int $invoiceId = null,
        ?int $salesmanId = null,
    ): ?string
    {
        if ($type === 'receivable') {
            return $project->lead()->value('customer_name') ?: $project->customer_name;
        }

        if ($contractorId) {
            return Contractor::query()->whereKey($contractorId)->value('contractor');
        }

        if ($vendorId) {
            return Vendor::query()->whereKey($vendorId)->value('vendor');
        }

        if ($salesmanId) {
            return Salesman::query()->whereKey($salesmanId)->value('salesman_name');
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

    /** @return array{type: string, message: string} */
    private function driveDeletionToast(string $message, ?bool $driveDeleted): array
    {
        return match ($driveDeleted) {
            true => ['type' => 'success', 'message' => $message.' The Google Drive copy was also removed.'],
            false => ['type' => 'warning', 'message' => $message.' Google Drive is disconnected, so its copy could not be removed.'],
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

    private function ensureReferralSalesmanIsSecondary(Project $project, mixed $salesmanId): void
    {
        if (! $salesmanId) {
            return;
        }

        $primarySalesmanId = (int) ($project->salesman_id ?: $project->lead?->salesman_1_id);
        if ($primarySalesmanId > 0 && $primarySalesmanId === (int) $salesmanId) {
            throw ValidationException::withMessages([
                'salesman_id' => 'Choose a second salesman. The original salesman already shares this referral sale.',
            ]);
        }
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


        if (! empty($data['project_invoice_id']) && ! empty($data['vendor_id'])) {
            $invoiceMatchesVendor = $project->invoices()
                ->whereKey($data['project_invoice_id'])
                ->where('vendor_id', $data['vendor_id'])
                ->exists();

            if (! $invoiceMatchesVendor) {
                throw ValidationException::withMessages([
                    'project_invoice_id' => 'The selected invoice must belong to the selected vendor.',
                ]);
            }
        }
    }
}
