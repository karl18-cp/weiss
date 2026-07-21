<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use App\Models\Contractor;
use App\Models\Lead;
use App\Models\Project;
use App\Models\ProjectAccountingTransaction;
use App\Models\ProjectInvoice;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LeadDataController extends Controller
{
    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        $agentId = $request->integer('agent') ?: null;

        $leads = Lead::query()
            ->with([
                'agent:agent_id,agent_name',
                'salesmanOne:salesman_id,salesman_name',
                'salesmanTwo:salesman_id,salesman_name',
                'latestTelemarketerNote',
                'project:id,lead_id',
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
                            ->where('agent_name', 'like', "%{$search}%"));
                });
            })
            ->latest()
            ->paginate(25)
            ->withQueryString()
            ->through(fn (Lead $lead): array => [
                'id' => $lead->id,
                'origin_at' => $lead->created_at?->toIso8601String(),
                'agent' => $lead->agent?->agent_name ?? 'Unassigned',
                'customer' => $lead->customer_name,
                'verified' => $this->isVerified($lead),
                'address' => $lead->address,
                'city' => $lead->city,
                'state' => $lead->state,
                'zip' => $lead->zip_code,
                'appointment_at' => $lead->appointment_at?->toIso8601String(),
                'lead_result' => $this->leadResult($lead),
                'rep' => $lead->rep ?: 'N/A',
                'appointment_result' => $lead->appointment_result ?: 'N/A',
                'mobile' => $lead->mobile_number ?: '—',
                'phone' => $lead->primary_number ?: '—',
                'note' => $lead->latestTelemarketerNote?->body ?: $lead->telemarketer_notes,
            ]);

        return Inertia::render('lead-workflow/data', [
            'leads' => $leads,
            'agents' => Agent::query()
                ->withCount('leads')
                ->orderBy('agent_name')
                ->get(['agent_id', 'agent_name']),
            'filters' => [
                'search' => $search,
                'agent' => $agentId,
            ],
            'totalLeads' => Lead::query()->count(),
        ]);
    }

    public function vendorInvoices(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));

        $invoices = ProjectInvoice::query()
            ->withSum([
                'accountingTransactions as approved_payments_total' => fn (Builder $query) => $query
                    ->where('type', 'payable')
                    ->whereIn('status', ['ok_to_pay', 'paid']),
            ], 'amount')
            ->with([
                'contractor:con_id,contractor',
                'project:id,lead_id',
                'project.lead:id,customer_name,address,city,state,zip_code,company_id',
                'project.lead.company:com_id,company,prefix',
            ])
            ->when($search !== '', function (Builder $query) use ($search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query
                        ->where('invoice_number', 'like', "%{$search}%")
                        ->orWhere('notes', 'like', "%{$search}%")
                        ->orWhere('status', 'like', "%{$search}%")
                        ->orWhereHas('contractor', fn (Builder $contractorQuery) => $contractorQuery
                            ->where('contractor', 'like', "%{$search}%"))
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
                'project_number' => ($invoice->project->lead->company?->prefix ?: 'PROJECT').'-'.str_pad((string) $invoice->project_id, 5, '0', STR_PAD_LEFT),
                'company_prefix' => $invoice->project->lead->company?->prefix ?? '—',
                'customer' => $invoice->project->lead->customer_name,
                'contractor' => [
                    'con_id' => $invoice->contractor->con_id,
                    'contractor' => $invoice->contractor->contractor,
                ],
                'invoice_number' => $invoice->invoice_number,
                'invoice_date' => $invoice->invoice_date->toDateString(),
                'amount' => $invoice->amount,
                'balance' => number_format(max(0, (float) $invoice->amount - (float) $invoice->approved_payments_total), 2, '.', ''),
                'notes' => $invoice->notes,
                'status' => $invoice->status,
                'file_name' => $invoice->file_name,
                'file_mime' => $invoice->file_mime,
            ]);

        return Inertia::render('lead-workflow/vendor-invoices', [
            'invoices' => $invoices,
            'filters' => ['search' => $search],
            'totalInvoices' => ProjectInvoice::query()->count(),
            'totalAmount' => ProjectInvoice::query()->sum('amount'),
            'projects' => Project::query()
                ->with(['lead:id,customer_name,address,city,state,zip_code,company_id', 'lead.company:com_id,prefix'])
                ->latest()
                ->get(['id', 'lead_id']),
            'contractors' => Contractor::query()->orderBy('contractor')->get(['con_id', 'contractor']),
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
        $query = ProjectAccountingTransaction::query()
            ->where('type', $type)
            ->with([
                'contractor:con_id,contractor',
                'invoice:id,project_id,invoice_number,amount,status',
                'project:id,lead_id',
                'project.lead:id,customer_name,address,city,state,zip_code,company_id',
                'project.lead.company:com_id,company,prefix',
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
                $company = $transaction->project->lead->company;

                return [
                    'id' => $transaction->id,
                    'project_id' => $transaction->project_id,
                    'project_number' => ($company?->prefix ?: 'PROJECT').'-'.str_pad((string) $transaction->project_id, 5, '0', STR_PAD_LEFT),
                    'company_prefix' => $company?->prefix ?? '—',
                    'customer' => $transaction->project->lead->customer_name,
                    'address' => trim(implode(', ', array_filter([
                        $transaction->project->lead->address,
                        $transaction->project->lead->city,
                        $transaction->project->lead->state.' '.$transaction->project->lead->zip_code,
                    ]))),
                    'transaction_date' => $transaction->transaction_date->toDateString(),
                    'reference_number' => $transaction->reference_number,
                    'received_from' => $transaction->counterparty,
                    'contractor' => $transaction->contractor?->contractor,
                    'invoice_number' => $transaction->invoice?->invoice_number,
                    'requested_by' => $transaction->requested_by,
                    'amount' => $transaction->amount,
                    'status' => $transaction->status,
                    'category' => $transaction->category,
                    'notes' => $transaction->notes,
                    'file_name' => $transaction->file_name,
                    'file_mime' => $transaction->file_mime,
                ];
            });

        return Inertia::render('lead-workflow/accounting-register', [
            'type' => $type,
            'transactions' => $transactions,
            'filters' => ['search' => $search],
            'totalAmount' => $totalAmount,
        ]);
    }

    private function leadResult(Lead $lead): string
    {
        if ($lead->salesman_1_id || $lead->salesman_2_id) {
            return 'Salesman Sent';
        }

        return match ($lead->status ?: 'fresh') {
            'fresh' => 'Freshly In',
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
