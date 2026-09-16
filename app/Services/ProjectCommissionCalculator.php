<?php

namespace App\Services;

use App\Models\Project;
use App\Models\Salesman;
use Illuminate\Support\Collection;

class ProjectCommissionCalculator
{
    /** @return array<string, mixed> */
    public function calculate(Project $project, Salesman $salesman): array
    {
        $project->loadMissing(['sales', 'accountingTransactions', 'invoices.accountingTransactions', 'lead']);
        $sales = $project->sales->sortBy(fn ($sale): string => ($sale->type === 'original' ? '0' : '1').$sale->sale_date?->format('Ymd').str_pad((string) $sale->id, 10, '0', STR_PAD_LEFT))->values();
        $referralOnlySalesmanIds = $sales->where('type', 'referral')->pluck('salesman_id')
            ->filter()->map(fn ($id): int => (int) $id)->unique();
        $originalSalesmanIds = collect([$project->salesman_id, $project->lead?->salesman_1_id, $project->lead?->salesman_2_id])
            ->filter(fn ($id): bool => ! $referralOnlySalesmanIds->contains((int) $id))
            ->filter()->map(fn ($id): int => (int) $id)->unique()->values();
        $isOriginalSalesman = $originalSalesmanIds->contains((int) $salesman->salesman_id);
        $stake = $isOriginalSalesman ? 1 / max(1, $originalSalesmanIds->count()) : 1.0;
        $eligibleSales = $isOriginalSalesman ? $sales : $sales->filter(
            fn ($sale): bool => $sale->type !== 'original' && (int) $sale->salesman_id === (int) $salesman->salesman_id,
        )->values();
        $payables = $project->accountingTransactions->where('type', 'payable');
        $isCommission = fn ($transaction): bool => str_contains(strtolower((string) $transaction->category), 'commission');
        $receivedBySale = $this->allocateReceivables(
            $sales,
            $project->accountingTransactions->where('type', 'receivable')->where('status', 'deposit'),
        );
        $expensesBySale = $this->allocateExpenses(
            $sales,
            $payables->reject($isCommission)->filter(
                fn ($transaction): bool => ! $transaction->project_invoice_id || $transaction->status === 'paid',
            ),
        );
        $openInvoicesBySale = $this->allocateOpenInvoices($sales, $project->invoices);
        $money = fn (float $amount): float => round($amount, 2, PHP_ROUND_HALF_EVEN);
        $saleRows = $eligibleSales->map(function ($sale) use ($salesman, $stake, $receivedBySale, $expensesBySale, $openInvoicesBySale, $money): array {
            $saleShare = (float) $sale->amount * $stake;
            $isDiscount = $saleShare < 0;
            $receivedShare = (float) ($receivedBySale[$sale->id] ?? 0) * $stake;
            $expenseShare = (float) ($expensesBySale[$sale->id] ?? 0) * $stake;
            $openInvoiceShare = (float) ($openInvoicesBySale[$sale->id] ?? 0) * $stake;
            $leadRate = $sale->type === 'original' ? (float) $salesman->initial_sale_cut_percent : (float) $salesman->change_order_cut_percent;
            $leadCost = $isDiscount ? 0.0 : $receivedShare * $leadRate / 100;
            $futureLeadCost = $isDiscount ? 0.0 : $saleShare * $leadRate / 100;
            $base = $isDiscount ? $saleShare : max(0, $receivedShare - $expenseShare - $openInvoiceShare - $leadCost);
            $futureBase = $isDiscount ? $saleShare : max(0, $saleShare - $expenseShare - $futureLeadCost);
            $rate = 50.0;

            return [
                'sale_id' => $sale->id, 'type' => $sale->type,
                'stake_percent' => $money($stake * 100), 'sale_share' => $money($saleShare),
                'received_share' => $money($receivedShare), 'expense_share' => $money($expenseShare),
                'open_invoices' => $money($openInvoiceShare),
                'lead_cost_rate' => $leadRate, 'lead_cost' => $money($leadCost),
                'commission_base' => $money($base), 'commission_due' => $money($base * $rate / 100),
                'maximum_commission' => $money($futureBase * $rate / 100),
            ];
        });
        $commissionPaid = (float) $payables->where('status', 'paid')->filter($isCommission)
            ->filter(fn ($transaction): bool => (int) $transaction->salesman_id === (int) $salesman->salesman_id)->sum('amount');
        $commissionDue = $money(max(0, (float) $saleRows->sum('commission_due')));
        $totalSale = $money((float) $saleRows->sum('sale_share'));
        $received = $money((float) $saleRows->sum('received_share'));

        return [
            'original_sale' => $money((float) $saleRows->where('type', 'original')->sum('sale_share')),
            'change_orders' => $money((float) $saleRows->where('type', '!=', 'original')->sum('sale_share')),
            'total_sale' => $totalSale,
            'received' => $received,
            'project_balance' => $money(max(0, $totalSale - $received)),
            'expenses' => $money((float) $saleRows->sum('expense_share')),
            'open_invoices' => $money((float) $saleRows->sum('open_invoices')),
            'lead_cost_rate' => (float) $salesman->initial_sale_cut_percent,
            'lead_cost' => $money((float) $saleRows->where('type', 'original')->sum('lead_cost')),
            'change_order_lead_cost_rate' => (float) $salesman->change_order_cut_percent,
            'change_order_lead_cost' => $money((float) $saleRows->where('type', '!=', 'original')->sum('lead_cost')),
            'commission_base' => $money(max(0, (float) $saleRows->sum('commission_base'))),
            'gross_profit' => $money(max(0, (float) $saleRows->sum('commission_base'))),
            'commission_rate' => 50.0,
            'commission_due' => $commissionDue,
            'maximum_commission' => $money(max(0, (float) $saleRows->sum('maximum_commission'))),
            'commission_paid' => $money($commissionPaid),
            'commission_balance' => $money(max(0, $commissionDue - $commissionPaid)),
            'sale_breakdown' => $saleRows->values()->all(),
        ];
    }

    private function allocateReceivables(Collection $sales, Collection $receivables): array
    {
        $allocated = $sales->mapWithKeys(fn ($sale): array => [$sale->id => 0.0])->all();
        foreach ($receivables->whereNotNull('project_sale_id') as $transaction) {
            if (array_key_exists($transaction->project_sale_id, $allocated)) $allocated[$transaction->project_sale_id] += (float) $transaction->amount;
        }
        foreach ($receivables->whereNull('project_sale_id')->sortBy('transaction_date') as $transaction) {
            $remaining = (float) $transaction->amount;
            foreach ($sales as $sale) {
                $applied = min($remaining, max(0, (float) $sale->amount - $allocated[$sale->id]));
                $allocated[$sale->id] += $applied;
                $remaining -= $applied;
                if ($remaining <= 0) break;
            }
        }
        return $allocated;
    }

    private function allocateExpenses(Collection $sales, Collection $expenses): array
    {
        $allocated = $sales->mapWithKeys(fn ($sale): array => [$sale->id => 0.0])->all();
        foreach ($expenses->whereNotNull('project_sale_id') as $transaction) {
            if (array_key_exists($transaction->project_sale_id, $allocated)) $allocated[$transaction->project_sale_id] += (float) $transaction->amount;
        }
        $unlinked = (float) $expenses->whereNull('project_sale_id')->sum('amount');
        $positiveSales = $sales->filter(fn ($sale): bool => (float) $sale->amount > 0);
        $totalSale = (float) $positiveSales->sum('amount');
        foreach ($positiveSales as $sale) $allocated[$sale->id] += $totalSale > 0 ? $unlinked * (float) $sale->amount / $totalSale : 0;
        return $allocated;
    }

    private function allocateOpenInvoices(Collection $sales, Collection $invoices): array
    {
        $allocated = $sales->mapWithKeys(fn ($sale): array => [$sale->id => 0.0])->all();
        $unlinked = 0.0;

        foreach ($invoices as $invoice) {
            $paid = (float) $invoice->accountingTransactions
                ->where('type', 'payable')
                ->where('status', 'paid')
                ->sum('amount');
            $open = max(0, (float) $invoice->amount - $paid);
            if ($invoice->project_sale_id && array_key_exists($invoice->project_sale_id, $allocated)) {
                $allocated[$invoice->project_sale_id] += $open;
            } else {
                $unlinked += $open;
            }
        }

        $positiveSales = $sales->filter(fn ($sale): bool => (float) $sale->amount > 0);
        $totalSale = (float) $positiveSales->sum('amount');
        foreach ($positiveSales as $sale) {
            $allocated[$sale->id] += $totalSale > 0 ? $unlinked * (float) $sale->amount / $totalSale : 0;
        }

        return $allocated;
    }
}
