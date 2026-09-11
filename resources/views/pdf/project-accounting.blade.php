<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 24px 30px; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #111; font-family: DejaVu Sans, sans-serif; font-size: 9px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        td, th { border: 1px solid #111; padding: 6px 7px; vertical-align: top; overflow-wrap: break-word; }
        .title { padding: 9px; color: #fff; background: #203864; font-size: 19px; font-weight: bold; text-align: center; }
        .document-title { padding: 8px; color: #fff; background: #4472c4; font-size: 13px; font-weight: bold; text-align: center; text-transform: uppercase; }
        .meta td { height: 42px; }
        .label { display: block; margin-bottom: 3px; color: #555; font-size: 7px; font-weight: bold; letter-spacing: .25px; text-transform: uppercase; }
        .value { font-size: 10px; font-weight: bold; }
        .summary-label { color: #fff; background: #4472c4; font-weight: bold; text-align: center; vertical-align: middle; }
        .money { color: #17365d; background: #ddebf7; font-size: 13px; font-weight: bold; text-align: center; vertical-align: middle; }
        .positive { color: #fff; background: #70ad47; }
        .negative { color: #fff; background: #c65911; }
        .transactions { margin-top: 10px; }
        .transactions thead { display: table-header-group; }
        .transactions tr { page-break-inside: avoid; }
        .transactions th { color: #fff; background: #4472c4; font-size: 8px; text-transform: uppercase; }
        .transactions td { min-height: 25px; }
        .transactions .date, .transactions .amount { white-space: nowrap; }
        .transactions .amount { text-align: right; font-weight: bold; }
        .empty { padding: 24px; color: #666; text-align: center; }
        .total td { color: #fff; background: #203864; font-size: 11px; font-weight: bold; }
        .total td:last-child { text-align: right; }
        .footer { position: fixed; right: 0; bottom: -12px; left: 0; color: #666; font-size: 7px; text-align: right; }
    </style>
</head>
<body>
    <div class="title">{{ strtoupper($project->lead?->company?->company ?? 'SBH CONSTRUCTION INC.') }}</div>
    <div class="document-title">{{ $type === 'payable' ? 'Expenses List' : 'Income List' }}</div>
    <table class="meta">
        <colgroup><col style="width:25%"><col style="width:25%"><col style="width:25%"><col style="width:25%"></colgroup>
        <tr>
            <td colspan="2"><span class="label">Job #</span><span class="value">{{ $project->project_number ?: '—' }}</span></td>
            <td colspan="2"><span class="label">Customer</span><span class="value">{{ $project->lead?->customer_name ?: '—' }}</span></td>
        </tr>
        @if($type === 'receivable')
            <tr>
                <td class="summary-label">Total Sale</td><td class="money">${{ number_format($saleAmount, 2) }}</td>
                <td class="summary-label">Total Received</td><td class="money">${{ number_format($income, 2) }}</td>
            </tr>
            <tr><td colspan="2" class="summary-label">Balance</td><td colspan="2" class="money {{ $saleAmount - $income <= 0 ? 'positive' : '' }}">${{ number_format($saleAmount - $income, 2) }}</td></tr>
        @else
            <tr>
                <td class="summary-label">Total Expenses</td><td class="money">${{ number_format($expenses, 2) }}</td>
                <td class="summary-label">Profit &amp; Loss</td><td class="money {{ $income - $expenses >= 0 ? 'positive' : 'negative' }}">${{ number_format($income - $expenses, 2) }}</td>
            </tr>
        @endif
    </table>
    <table class="transactions">
        <colgroup><col style="width:19%"><col style="width:18%"><col style="width:15%"><col style="width:13%"><col style="width:14%"><col style="width:21%"></colgroup>
        <thead><tr><th>For</th><th>Memo</th><th>Type #</th><th>Date</th><th>Amount</th><th>Notes</th></tr></thead>
        <tbody>
            @forelse($transactions as $transaction)
                @php
                    $for = $transaction->contractor?->contractor
                        ?? $transaction->vendor?->vendor
                        ?? $transaction->salesman?->salesman_name
                        ?? $transaction->counterparty
                        ?? $transaction->company?->company
                        ?? 'Unassigned';
                    $reference = $transaction->reference_number
                        ?? $transaction->invoice_order_number
                        ?? $transaction->invoice?->invoice_number
                        ?? '—';
                @endphp
                <tr>
                    <td>{{ $for }}</td>
                    <td>{{ $transaction->category }}</td>
                    <td>{{ $reference }}</td>
                    <td class="date">{{ $transaction->transaction_date?->format('m/d/Y') }}</td>
                    <td class="amount">${{ number_format((float) $transaction->amount, 2) }}</td>
                    <td>{{ $transaction->notes }}</td>
                </tr>
            @empty
                <tr><td colspan="6" class="empty">No {{ $type === 'payable' ? 'payables' : 'receivables' }} recorded for this project.</td></tr>
            @endforelse
            <tr class="total"><td colspan="4">TOTAL</td><td colspan="2">${{ number_format((float) $transactions->sum('amount'), 2) }}</td></tr>
        </tbody>
    </table>
    <div class="footer">Generated {{ now('America/Los_Angeles')->format('m/d/Y g:i A T') }}</div>
</body>
</html>
