<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use App\Models\Company;
use App\Models\Contractor;
use App\Models\Lead;
use App\Models\Project;
use App\Models\ProjectAccountingTransaction;
use App\Models\ProjectInvoice;
use App\Models\Vendor;
use App\Services\GoogleDriveProjectStorage;
use App\Support\ManagerAccess;
use App\Support\LeadSearch;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class LeadDataController extends Controller
{
    public function __construct(private readonly GoogleDriveProjectStorage $googleDrive) {}

    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        $agentId = $request->integer('agent') ?: null;
        $sort = (string) $request->query('sort', 'origin');
        $direction = $request->query('direction') === 'asc' ? 'asc' : 'desc';
        $sortColumns = [
            'origin' => 'created_at',
            'customer' => 'customer_name',
            'address' => 'address',
            'city' => 'city',
            'state' => 'state',
            'zip' => 'zip_code',
            'appointment' => 'appointment_at',
            'lead_result' => 'status',
            'appointment_result' => 'appointment_result',
            'mobile' => 'mobile_number',
            'phone' => 'primary_number',
            'note' => 'telemarketer_notes',
        ];
        $sort = array_key_exists($sort, $sortColumns) || in_array($sort, ['agent', 'verified', 'rep', 'company'], true)
            ? $sort
            : 'origin';

        $leads = Lead::query()
            ->whereDoesntHave('project', fn (Builder $query) => $query->where('tele_lead_excluded', true))
            ->with([
                'agent:agent_id,agent_name',
                'salesmanOne:salesman_id,salesman_name',
                'salesmanTwo:salesman_id,salesman_name',
                'company:com_id,prefix',
                'latestTelemarketerNote',
                'project:id,lead_id,project_number',
            ])
            ->when($agentId, fn (Builder $query) => $query->where('agent_id', $agentId))
            ->when($search !== '', function (Builder $query) use ($search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query
                        ->where('customer_name', 'like', "%{$search}%")
                        ->orWhere('address', 'like', "%{$search}%")
                        ->orWhere('city', 'like', "%{$search}%")
                        ->orWhere('state', 'like', "%{$search}%")
                        ->orWhere('zip_code', 'like', "%{$search}%")
                        ->orWhere('primary_number', 'like', "%{$search}%")
                        ->orWhere('mobile_number', 'like', "%{$search}%")
                        ->orWhereHas('agent', fn (Builder $agentQuery) => $agentQuery
                            ->where('agent_name', 'like', "%{$search}%"))
                        ->orWhereHas('salesmanOne', fn (Builder $salesmanQuery) => $salesmanQuery
                            ->where('salesman_name', 'like', "%{$search}%"))
                        ->orWhereHas('salesmanTwo', fn (Builder $salesmanQuery) => $salesmanQuery
                            ->where('salesman_name', 'like', "%{$search}%"))
                        ->orWhereHas('company', fn (Builder $companyQuery) => $companyQuery
                            ->where('prefix', 'like', "%{$search}%"));
                    LeadSearch::orWhereFullAddress($query, $search);
                });
            })
            ->when($sort === 'agent', fn (Builder $query) => $query
                ->orderBy(
                    Agent::query()->select('agent_name')->whereColumn('agents.agent_id', 'leads.agent_id'),
                    $direction,
                ))
            ->when($sort === 'verified', fn (Builder $query) => $query
                ->orderByRaw(
                    "CASE WHEN status IN ('confirmed', 'dispatched', 'salesman_sent') OR salesman_1_id IS NOT NULL OR salesman_2_id IS NOT NULL OR appointment_result = 'Salesman Sent' THEN 1 ELSE 0 END {$direction}",
                ))
            ->when($sort === 'rep', fn (Builder $query) => $query->orderByRaw(
                "COALESCE((SELECT salesman_name FROM salesmen WHERE salesmen.salesman_id = leads.salesman_1_id), (SELECT salesman_name FROM salesmen WHERE salesmen.salesman_id = leads.salesman_2_id), '') {$direction}",
            ))
            ->when($sort === 'company', fn (Builder $query) => $query->orderBy(
                Company::query()->select('prefix')->whereColumn('companies.com_id', 'leads.company_id'),
                $direction,
            ))
            ->when(isset($sortColumns[$sort]), fn (Builder $query) => $query
                ->orderBy($sortColumns[$sort], $direction))
            ->orderByDesc('id')
            ->paginate(25)
            ->withQueryString()
            ->through(fn (Lead $lead): array => [
                'id' => $lead->id,
                'origin_at' => $lead->created_at?->toIso8601String(),
                'agent_id' => $lead->agent_id,
                'agent' => $lead->agent?->agent_name ?? 'Unassigned',
                'customer' => $lead->customer_name,
                'verified' => $this->isVerified($lead),
                'address' => $lead->address,
                'city' => $lead->city,
                'state' => $lead->state,
                'zip' => $lead->zip_code,
                'appointment_at' => $lead->appointment_at?->toIso8601String(),
                'lead_result' => $this->leadResult($lead),
                'rep' => collect([
                    $lead->salesmanOne?->salesman_name,
                    $lead->salesmanTwo?->salesman_name,
                ])->filter()->unique()->implode(', ') ?: 'N/A',
                'company' => $lead->company?->prefix ?: 'N/A',
                'appointment_result' => $lead->appointment_result ?: 'N/A',
                'mobile' => $lead->mobile_number ?: '—',
                'phone' => $lead->primary_number ?: '—',
                'note' => $lead->latestTelemarketerNote?->body ?: $lead->telemarketer_notes,
            ]);

        return Inertia::render('lead-workflow/data', [
            'leads' => $leads,
            'agents' => Agent::query()
                ->withCount(['leads' => fn (Builder $query) => $query
                    ->whereDoesntHave('project', fn (Builder $projectQuery) => $projectQuery
                        ->where('tele_lead_excluded', true))])
                ->orderBy('agent_name')
                ->get(['agent_id', 'agent_name']),
            'filters' => [
                'search' => $search,
                'agent' => $agentId,
                'sort' => $sort,
                'direction' => $direction,
            ],
            'totalLeads' => Lead::query()
                ->whereDoesntHave('project', fn (Builder $query) => $query->where('tele_lead_excluded', true))
                ->count(),
            'canEdit' => ManagerAccess::canEdit($request->user(), 'data'),
        ]);
    }

    public function updateOriginalAgent(Request $request, Lead $lead)
    {
        abort_unless(ManagerAccess::canEdit($request->user(), 'data'), 403);

        $validated = $request->validate([
            'agent_id' => ['required', 'integer', 'exists:agents,agent_id'],
        ]);

        $lead->update(['agent_id' => $validated['agent_id']]);

        return back()->with('success', 'Original agent updated.');
    }

    public function vendorInvoices(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        $showAll = $request->boolean('show_all');

        $invoiceTotals = ProjectInvoice::query()
            ->withSum([
                'accountingTransactions as approved_payments_total' => fn (Builder $query) => $query
                    ->where('type', 'payable')
                    ->where('status', 'paid'),
            ], 'amount')
            ->get(['id', 'amount']);
        $outstandingInvoices = $invoiceTotals->filter(
            fn (ProjectInvoice $invoice): bool => max(
                0,
                (float) $invoice->amount - (float) $invoice->approved_payments_total,
            ) > 0,
        );

        $invoices = ProjectInvoice::query()
            ->addSelect([
                'linked_project_number' => Project::query()
                    ->select('project_number')
                    ->whereColumn('projects.id', 'project_invoices.project_id')
                    ->limit(1),
            ])
            ->withSum([
                'accountingTransactions as approved_payments_total' => fn (Builder $query) => $query
                    ->where('type', 'payable')
                    ->where('status', 'paid'),
            ], 'amount')
            ->with([
                'contractor:con_id,contractor',
                'vendor:vendor_id,vendor',
                'project:id,lead_id',
                'project.lead:id,customer_name,address,city,state,zip_code,company_id,salesman_1_id,salesman_2_id',
                'project.lead.company:com_id,company,prefix',
                'project.lead.salesmanOne:salesman_id,salesman_name',
                'project.lead.salesmanTwo:salesman_id,salesman_name',
                'documents:id,project_id,project_invoice_id,file_name,file_mime,category,created_at',
            ])
            ->when(! $showAll, fn (Builder $query) => $query->whereKey($outstandingInvoices->pluck('id')))
            ->when($search !== '', function (Builder $query) use ($search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query
                        ->where('invoice_number', 'like', "%{$search}%")
                        ->orWhere('notes', 'like', "%{$search}%")
                        ->orWhere('status', 'like', "%{$search}%")
                        ->orWhereHas('contractor', fn (Builder $contractorQuery) => $contractorQuery
                            ->where('contractor', 'like', "%{$search}%"))
                        ->orWhereHas('vendor', fn (Builder $vendorQuery) => $vendorQuery
                            ->where('vendor', 'like', "%{$search}%"))
                        ->orWhereHas('project.lead', fn (Builder $leadQuery) => $leadQuery
                            ->where('customer_name', 'like', "%{$search}%")
                            ->orWhere('address', 'like', "%{$search}%")
                            ->orWhereHas('company', fn (Builder $companyQuery) => $companyQuery
                                ->where('company', 'like', "%{$search}%")
                                ->orWhere('prefix', 'like', "%{$search}%")));
                });
            })
            ->latest('invoice_date')
            ->paginate(25)
            ->withQueryString()
            ->through(fn (ProjectInvoice $invoice): array => [
                'id' => $invoice->id,
                'project_id' => $invoice->project_id,
                'project_number' => $invoice->getAttribute('linked_project_number')
                    ?: $invoice->project?->project_number
                    ?: 'Not assigned',
                'company_prefix' => $invoice->project?->lead?->company?->prefix ?? '—',
                'customer' => $invoice->project?->lead?->customer_name ?? 'Unassigned',
                'rep' => collect([
                    $invoice->project?->lead?->salesmanOne?->salesman_name,
                    $invoice->project?->lead?->salesmanTwo?->salesman_name,
                ])->filter()->join(', ') ?: 'Unassigned',
                'contractor' => $invoice->contractor ? [
                    'con_id' => $invoice->contractor->con_id,
                    'contractor' => $invoice->contractor->contractor,
                ] : null,
                'vendor' => $invoice->vendor ? [
                    'vendor_id' => $invoice->vendor->vendor_id,
                    'vendor' => $invoice->vendor->vendor,
                ] : null,
                'invoice_number' => $invoice->invoice_number,
                'invoice_date' => $invoice->invoice_date->toDateString(),
                'amount' => $invoice->amount,
                'balance' => number_format(max(0, (float) $invoice->amount - (float) $invoice->approved_payments_total), 2, '.', ''),
                'notes' => $invoice->notes,
                'status' => $invoice->status,
                'file_name' => $invoice->file_name,
                'file_mime' => $invoice->file_mime,
                'documents' => $invoice->documents->map(fn ($document): array => [
                    'id' => $document->id,
                    'file_name' => $document->file_name,
                    'file_mime' => $document->file_mime,
                ])->values(),
            ]);

        return Inertia::render('lead-workflow/vendor-invoices', [
            'invoices' => $invoices,
            'filters' => ['search' => $search, 'show_all' => $showAll],
            'totalInvoices' => $outstandingInvoices->count(),
            'totalAmount' => $invoiceTotals->sum('amount'),
            'totalBalance' => $invoiceTotals->sum(
                fn (ProjectInvoice $invoice): float => max(
                    0,
                    (float) $invoice->amount - (float) $invoice->approved_payments_total,
                ),
            ),
            'outstandingInvoiceCount' => $outstandingInvoices->count(),
            'projects' => Project::query()
                ->with([
                    'lead:id,customer_name,address,city,state,zip_code,company_id',
                    'lead.company:com_id,prefix',
                    'documents:id,project_id,file_name,file_mime,category,created_at',
                ])
                ->latest()
                ->get([
                    'id', 'lead_id', 'project_number', 'customer_name',
                    'address', 'city', 'state', 'zip_code',
                ]),
            'contractors' => Contractor::query()->whereNull('moved_to_vendor_at')->orderBy('contractor')->get(['con_id', 'contractor']),
            'vendors' => Vendor::query()->orderBy('vendor')->get(['vendor_id', 'vendor']),
        ]);
    }

    public function receivables(Request $request): Response
    {
        return $this->accountingRegister($request, 'receivable');
    }

    public function payables(Request $request): Response
    {
        return $this->accountingRegister($request, 'payable');
    }

    private function accountingRegister(Request $request, string $type): Response
    {
        $search = trim((string) $request->query('search', ''));
        $showAll = $request->boolean('show_all');
        $requestedInvoiceId = $request->integer('invoice') ?: null;
        $query = ProjectAccountingTransaction::query()
            ->addSelect([
                'linked_project_number' => Project::query()
                    ->select('project_number')
                    ->whereColumn('projects.id', 'project_accounting_transactions.project_id')
                    ->limit(1),
            ])
            ->where('type', $type)
            ->when(! $showAll && $type === 'receivable', fn (Builder $query) => $query->where('qb', false))
            ->when(! $showAll && $type === 'payable', fn (Builder $query) => $query->where('status', '!=', 'paid'))
            ->with([
                'contractor:con_id,contractor',
                'invoice:id,project_id,contractor_id,invoice_number,amount,status',
                'project:id,lead_id,project_number',
                'project.lead:id,customer_name,address,city,state,zip_code,company_id,salesman_1_id,salesman_2_id',
                'project.lead.company:com_id,company,prefix',
                'project.lead.salesmanOne:salesman_id,salesman_name',
                'project.lead.salesmanTwo:salesman_id,salesman_name',
                'documents:id,project_id,project_accounting_transaction_id,file_name,file_mime,category,created_at',
            ])
            ->when($search !== '', function (Builder $query) use ($search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query
                        ->where('reference_number', 'like', "%{$search}%")
                        ->orWhere('category', 'like', "%{$search}%")
                        ->orWhere('counterparty', 'like', "%{$search}%")
                        ->orWhere('requested_by', 'like', "%{$search}%")
                        ->orWhere('notes', 'like', "%{$search}%")
                        ->orWhere('status', 'like', "%{$search}%")
                        ->orWhereHas('contractor', fn (Builder $contractorQuery) => $contractorQuery
                            ->where('contractor', 'like', "%{$search}%"))
                        ->orWhereHas('invoice', fn (Builder $invoiceQuery) => $invoiceQuery
                            ->where('invoice_number', 'like', "%{$search}%"))
                        ->orWhereHas('project.lead', fn (Builder $leadQuery) => $leadQuery
                            ->where('customer_name', 'like', "%{$search}%")
                            ->orWhere('address', 'like', "%{$search}%")
                            ->orWhere('city', 'like', "%{$search}%")
                            ->orWhere('zip_code', 'like', "%{$search}%")
                            ->orWhereHas('company', fn (Builder $companyQuery) => $companyQuery
                                ->where('company', 'like', "%{$search}%")
                                ->orWhere('prefix', 'like', "%{$search}%")));

                    if (ctype_digit($search)) {
                        $query->orWhere('project_id', (int) $search);
                    }
                });
            });

        $totalAmount = (clone $query)->sum('amount');
        $transactions = $query
            ->latest('transaction_date')
            ->latest('id')
            ->paginate(25)
            ->withQueryString()
            ->through(function (ProjectAccountingTransaction $transaction): array {
                $project = $transaction->project;
                $lead = $project?->lead;
                $company = $lead?->company;

                return [
                    'id' => $transaction->id,
                    'project_id' => $transaction->project_id,
                    'project_number' => $project
                        ? ($transaction->getAttribute('linked_project_number') ?: $project->project_number ?: 'Not assigned')
                        : 'Unassigned',
                    'company_prefix' => $company?->prefix ?? '—',
                    'customer' => $lead?->customer_name ?? ($transaction->counterparty ?: 'Unassigned'),
                    'rep' => collect([
                        $lead?->salesmanOne?->salesman_name,
                        $lead?->salesmanTwo?->salesman_name,
                    ])->filter()->join(', ') ?: 'Unassigned',
                    'address' => $lead
                        ? trim(implode(', ', array_filter([
                            $lead->address,
                            $lead->city,
                            trim(($lead->state ?? '').' '.($lead->zip_code ?? '')),
                        ])))
                        : 'Not linked to a project',
                    'transaction_date' => $transaction->transaction_date->toDateString(),
                    'reference_number' => $transaction->reference_number,
                    'received_from' => $transaction->counterparty,
                    'contractor' => $transaction->contractor?->contractor,
                    'invoice_number' => $transaction->invoice?->invoice_number
                        ?? ($transaction->project_id === null ? $transaction->category : null),
                    'invoice_order_number' => $transaction->invoice_order_number,
                    'requested_by' => $transaction->requested_by,
                    'amount' => $transaction->amount,
                    'status' => $transaction->status,
                    'qb' => $transaction->qb,
                    'payment_method' => $transaction->payment_method,
                    'category' => $transaction->category,
                    'notes' => $transaction->notes,
                    'file_name' => $transaction->file_name,
                    'file_mime' => $transaction->file_mime,
                    'documents' => $transaction->documents->map(fn ($document): array => [
                        'id' => $document->id,
                        'file_name' => $document->file_name,
                        'file_mime' => $document->file_mime,
                    ])->values(),
                ];
            });

        return Inertia::render('lead-workflow/accounting-register', [
            'type' => $type,
            'transactions' => $transactions,
            'filters' => ['search' => $search, 'invoice' => $requestedInvoiceId, 'show_all' => $showAll],
            'totalAmount' => $totalAmount,
            'projects' => Project::query()
                ->with([
                    'lead:id,customer_name,address,city,state,zip_code,company_id',
                    'lead.company:com_id,prefix',
                    'documents:id,project_id,file_name,file_mime,category,created_at',
                ])
                ->latest()
                ->get(['id', 'lead_id', 'project_number']),
            'contractors' => Contractor::query()->whereNull('moved_to_vendor_at')->orderBy('contractor')->get(['con_id', 'contractor']),
            'invoices' => ProjectInvoice::query()
                ->with(['contractor:con_id,contractor', 'vendor:vendor_id,vendor'])
                ->withSum([
                    'accountingTransactions as paid_total' => fn (Builder $query) => $query
                        ->where('type', 'payable')
                        ->where('status', 'paid'),
                ], 'amount')
                ->where('status', '!=', 'paid')
                ->latest('invoice_date')
                ->get(['id', 'project_id', 'contractor_id', 'vendor_id', 'invoice_number', 'amount'])
                ->map(fn (ProjectInvoice $invoice): array => [
                    'id' => $invoice->id,
                    'project_id' => $invoice->project_id,
                    'contractor_id' => $invoice->contractor_id,
                    'contractor' => $invoice->contractor?->contractor,
                    'vendor' => $invoice->vendor?->vendor,
                    'invoice_number' => $invoice->invoice_number,
                    'balance' => number_format(max(0, (float) $invoice->amount - (float) $invoice->paid_total), 2, '.', ''),
                ]),
        ]);
    }

    public function storeAccountingTransaction(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(['receivable', 'payable'])],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'project_invoice_id' => ['nullable', 'integer', 'exists:project_invoices,id'],
            'project_document_id' => ['nullable', 'integer', 'exists:project_documents,id'],
            'contractor_id' => ['nullable', 'integer', 'exists:contractors,con_id'],
            'transaction_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:9999999999.99'],
            'payment_method' => ['nullable', Rule::in(['check', 'zelle', 'credit_card', 'wire_transfer', 'square_transfer', 'cash'])],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'invoice_order_number' => ['nullable', 'string', 'max:100'],
            'status' => ['required', Rule::in(['pending', 'deposit', 'ok_to_pay', 'paid'])],
            'notes' => ['nullable', 'string', 'max:5000'],
            'payable_for' => ['nullable', 'string', 'max:255'],
            'file' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,webp,heic,heif', 'max:20480'],
        ]);

        $referenceNumber = trim((string) ($data['reference_number'] ?? ''));
        $hasReferenceNumber = ! in_array($referenceNumber, ['', 'CH#', 'ZELLE', 'CC-', 'WIRE-', 'SQUARE-', 'CASH-'], true);

        if ($data['type'] === 'payable' && $hasReferenceNumber) {
            $data['status'] = 'paid';
            $data['payment_method'] = $data['payment_method'] ?? 'check';
        }

        if ($data['type'] === 'receivable') {
            $data['status'] = 'deposit';
            $data['payment_method'] = $data['payment_method'] ?? 'check';
            $data['project_invoice_id'] = null;
            $data['contractor_id'] = null;
        } else {
            $invoice = filled($data['project_invoice_id'] ?? null)
                ? ProjectInvoice::query()->findOrFail($data['project_invoice_id'])
                : null;
            if ($invoice) {
                $data['project_id'] = $invoice->project_id;
                $data['contractor_id'] = $invoice->contractor_id;
                if (! $invoice->contractor_id && $invoice->vendor) {
                    $data['payable_for'] = $invoice->vendor->vendor;
                }
                $paid = (float) $invoice->accountingTransactions()
                    ->where('type', 'payable')
                    ->where('status', 'paid')
                    ->sum('amount');
                $balance = max(0, (float) $invoice->amount - $paid);
                if (round((float) $data['amount'], 2) > round($balance, 2)) {
                    throw ValidationException::withMessages([
                        'amount' => 'This payment exceeds the invoice balance of $'.number_format($balance, 2).'.',
                    ]);
                }
            }

            if (! filled($data['contractor_id'] ?? null) && ! filled($data['payable_for'] ?? null)) {
                throw ValidationException::withMessages([
                    'payable_for' => 'Describe what this payable is for when no contractor is selected.',
                ]);
            }
        }

        if (in_array($data['status'], ['deposit', 'paid'], true)) {
            $this->validatePaymentDetails($data);
        } else {
            $data['payment_method'] = null;
            $data['reference_number'] = null;
        }

        $project = filled($data['project_id'] ?? null) ? Project::query()->find($data['project_id']) : null;
        if (filled($data['project_document_id'] ?? null)) {
            if (! $project) {
                throw ValidationException::withMessages([
                    'project_document_id' => 'Select a project before choosing a project file.',
                ]);
            }

            $document = $project->documents()->find($data['project_document_id']);
            if (! $document) {
                throw ValidationException::withMessages([
                    'project_document_id' => 'The selected file must belong to this project.',
                ]);
            }

            $data = [
                ...$data,
                'file_path' => $document->file_path,
                'file_name' => $document->file_name,
                'file_mime' => $document->file_mime,
                'file_size' => $document->file_size,
            ];
        }
        $data['category'] = $data['type'] === 'receivable'
            ? 'Customer Check'
            : (trim((string) ($data['payable_for'] ?? '')) ?: 'Vendor Payment');
        $data['counterparty'] = $data['type'] === 'receivable'
            ? ($project?->lead()->value('customer_name') ?: 'Unassigned customer')
            : (filled($data['contractor_id'] ?? null)
                ? Contractor::query()->whereKey($data['contractor_id'])->value('contractor')
                : trim((string) ($data['payable_for'] ?? '')));
        $data['requested_by'] = $request->user()?->manager?->manager_name ?: $request->user()?->username;
        $data['qb'] = false;
        unset($data['payable_for']);

        if ($file = $request->file('file')) {
            $data = [
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
        unset($data['file']);

        $transaction = ProjectAccountingTransaction::query()->create($data);

        $message = ucfirst($data['type']).' added.';
        if ($project && $transaction->file_path && $transaction->file_name) {
            try {
                $this->googleDrive->mirror($project, $transaction->file_path, $transaction->file_name, $transaction->file_mime);
                $message .= ' The attachment was also uploaded to Google Drive.';
            } catch (\Throwable $exception) {
                Log::warning('Global accounting attachment Drive sync failed.', [
                    'project_id' => $project->id,
                    'transaction_id' => $transaction->id,
                    'error' => $exception->getMessage(),
                ]);
                $message .= ' The record was saved, but Google Drive sync failed.';
            }
        }

        return back()->with('success', $message);
    }

    public function updateAccountingStatus(
        Request $request,
        ProjectAccountingTransaction $accountingTransaction,
    ): RedirectResponse {
        $data = $request->validate([
            'status' => ['required', Rule::in(['pending', 'deposit', 'ok_to_pay', 'paid'])],
            'payment_method' => ['nullable', Rule::in(['check', 'zelle', 'credit_card', 'wire_transfer', 'square_transfer', 'cash'])],
            'reference_number' => ['nullable', 'string', 'max:100'],
        ]);

        if ($accountingTransaction->type === 'receivable' && ! in_array($data['status'], ['pending', 'deposit'], true)) {
            throw ValidationException::withMessages(['status' => 'Receivables can only be Pending or Deposit.']);
        }

        if ($accountingTransaction->type === 'payable' && $data['status'] === 'deposit') {
            throw ValidationException::withMessages(['status' => 'Deposit is only available for receivables.']);
        }

        if (
            $accountingTransaction->type === 'payable'
            && $data['status'] === 'paid'
            && ! ($data['payment_method'] ?? $accountingTransaction->payment_method)
        ) {
            throw ValidationException::withMessages([
                'status' => 'Select a payment method before marking this payable Paid.',
            ]);
        }

        if ($accountingTransaction->type === 'payable' && $data['status'] === 'paid') {
            $data['payment_method'] = $data['payment_method'] ?? $accountingTransaction->payment_method;
            $data['reference_number'] = $data['reference_number'] ?? $accountingTransaction->reference_number;
            $this->validatePaymentDetails($data);
        }

        $accountingTransaction->update($data);

        return back()->with('success', ucfirst($accountingTransaction->type).' status updated.');
    }

    private function validatePaymentDetails(array $data): void
    {
        $method = $data['payment_method'] ?? null;
        $reference = trim((string) ($data['reference_number'] ?? ''));
        if ($reference === '') {
            return;
        }
        $prefix = match ($method) {
            'check' => 'CH#',
            'zelle' => 'ZELLE',
            'credit_card' => 'CC-',
            'wire_transfer' => 'WIRE-',
            'square_transfer' => 'SQUARE-',
            'cash' => 'CASH-',
            default => null,
        };

        if (! $prefix || ! str_starts_with($reference, $prefix)) {
            throw ValidationException::withMessages([
                'reference_number' => 'Enter a valid check or reference number for the selected payment method.',
            ]);
        }
    }

    private function leadResult(Lead $lead): string
    {
        if ($lead->salesman_1_id || $lead->salesman_2_id) {
            return 'Salesman Sent';
        }

        return match ($lead->status ?: 'fresh') {
            'fresh' => 'Freshly In',
            'verify' => 'Verify',
            'cb', 'rehash_cb', 'kit_cb' => 'CB',
            'naov' => 'NAOV',
            'toss', 'rehash_toss', 'kit_toss' => 'Toss',
            'confirmed' => 'Confirm',
            'dispatched' => 'Dispatch',
            'salesman_sent' => 'Salesman Sent',
            'reschedule' => 'Reschedule',
            'rehash' => 'Rehash',
            'rehash_ng', 'kit_ng' => 'NG',
            '555' => '555',
            'la' => 'LA',
            'his' => 'HIS',
            'kit' => 'Keep in Touch',
            'project' => 'Project',
            default => str($lead->status)->replace('_', ' ')->title()->toString(),
        };
    }

    private function isVerified(Lead $lead): bool
    {
        return in_array($lead->status, ['confirmed', 'dispatched', 'salesman_sent'], true)
            || $lead->salesman_1_id !== null
            || $lead->salesman_2_id !== null
            || $lead->appointment_result === 'Salesman Sent';
    }
}
