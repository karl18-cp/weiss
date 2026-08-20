<?php

namespace App\Http\Controllers;

use App\Http\Requests\ContractorRequest;
use App\Models\Contractor;
use App\Models\ProjectAccountingTransaction;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\JsonResponse;
use Inertia\Inertia;
use Inertia\Response;

class ContractorController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('management/contractors', [
            'contractors' => Contractor::query()->whereNull('moved_to_vendor_at')->orderBy('contractor')->get(),
        ]);
    }

    public function store(ContractorRequest $request): RedirectResponse
    {
        Contractor::query()->create($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Contractor created.']);

        return back();
    }

    public function report(Contractor $contractor): JsonResponse
    {
        $projectNumber = static function ($project): string {
            if (! $project) {
                return 'Unassigned';
            }

            $prefix = $project->lead?->company?->prefix ?: 'PROJECT';

            return $prefix.'-'.str_pad((string) $project->id, 5, '0', STR_PAD_LEFT);
        };

        $invoices = $contractor->projectInvoices()
            ->with([
                'project:id,lead_id',
                'project.lead:id,company_id,customer_name',
                'project.lead.company:com_id,prefix',
            ])
            ->withSum([
                'accountingTransactions as paid_total' => fn ($query) => $query
                    ->where('type', 'payable')
                    ->where('status', 'paid'),
            ], 'amount')
            ->latest('invoice_date')
            ->get()
            ->map(fn ($invoice): array => [
                'key' => 'invoice-'.$invoice->id,
                'type' => 'Invoice',
                'project_id' => $invoice->project_id,
                'project_number' => $projectNumber($invoice->project),
                'customer' => $invoice->project?->lead?->customer_name ?: 'Unassigned',
                'reference' => $invoice->invoice_number,
                'date' => $invoice->invoice_date?->toDateString(),
                'amount' => $invoice->amount,
                'balance' => number_format(max(0, (float) $invoice->amount - (float) $invoice->paid_total), 2, '.', ''),
                'status' => $invoice->status,
                'notes' => $invoice->notes,
            ]);

        $payables = ProjectAccountingTransaction::query()
            ->where('type', 'payable')
            ->where(function ($query) use ($contractor): void {
                $query->where('contractor_id', $contractor->con_id)
                    ->orWhereHas('invoice', fn ($invoiceQuery) => $invoiceQuery
                        ->where('contractor_id', $contractor->con_id));
            })
            ->with([
                'invoice:id,invoice_number',
                'project:id,lead_id',
                'project.lead:id,company_id,customer_name',
                'project.lead.company:com_id,prefix',
            ])
            ->latest('transaction_date')
            ->get()
            ->map(fn ($payable): array => [
                'key' => 'payable-'.$payable->id,
                'type' => 'Payable',
                'project_id' => $payable->project_id,
                'project_number' => $projectNumber($payable->project),
                'customer' => $payable->project?->lead?->customer_name ?: 'Unassigned',
                'reference' => $payable->invoice?->invoice_number ?: ($payable->reference_number ?: '—'),
                'date' => $payable->transaction_date?->toDateString(),
                'amount' => $payable->amount,
                'balance' => $payable->status === 'paid' ? '0.00' : $payable->amount,
                'status' => $payable->status,
                'notes' => $payable->notes,
            ]);

        return response()->json([
            'contractor' => ['id' => $contractor->con_id, 'name' => $contractor->contractor],
            'summary' => [
                'invoices' => $invoices->count(),
                'invoice_total' => $invoices->sum(fn ($row) => (float) $row['amount']),
                'invoice_balance' => $invoices->sum(fn ($row) => (float) $row['balance']),
                'payables' => $payables->count(),
                'payable_total' => $payables->sum(fn ($row) => (float) $row['amount']),
            ],
            'rows' => $invoices->concat($payables)->sortByDesc('date')->values(),
        ]);
    }

    public function update(ContractorRequest $request, Contractor $contractor): RedirectResponse
    {
        $contractor->update($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Contractor updated.']);

        return back();
    }

    public function destroy(Contractor $contractor): RedirectResponse
    {

        $contractor->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Contractor deleted.']);

        return back();
    }
}
