<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 34px; }
        body { color:#172033; font-family:DejaVu Sans,sans-serif; font-size:10px; }
        h1 { margin:0; color:#fff; background:#1f4e79; padding:14px; text-align:center; font-size:20px; }
        .subtitle { margin:0 0 18px; padding:7px; background:#d9eaf7; text-align:center; font-weight:bold; }
        table { width:100%; border-collapse:collapse; margin-bottom:16px; }
        th,td { border:1px solid #9aa9ba; padding:8px; }
        th { width:34%; background:#edf3f8; text-align:left; }
        .section { color:#fff; background:#4472c4; font-weight:bold; text-transform:uppercase; }
        .money { text-align:right; font-weight:bold; }
        .total { background:#e2f0d9; font-size:12px; }
        .signatures td { height:70px; vertical-align:bottom; }
        .footer { color:#6b7280; font-size:8px; text-align:right; }
    </style>
</head>
<body>
    <h1>PROJECT COMPLETION FORM</h1>
    <div class="subtitle">{{ $audience === 'office' ? 'OFFICE COPY — COMPLETE ACCOUNTING TOTALS' : 'SALESMAN COPY — SALESMAN ACCOUNTING TOTALS' }}</div>
    <table>
        <tr><th>Job #</th><td>{{ $project->project_number }}</td><th>Completion date</th><td>{{ now('America/Los_Angeles')->format('m/d/Y') }}</td></tr>
        <tr><th>Customer</th><td>{{ $project->lead?->customer_name }}</td><th>Company</th><td>{{ $project->lead?->company?->company }}</td></tr>
        <tr><th>Project</th><td colspan="3">{{ $project->lead?->product?->description ?: $project->lead?->product?->product_name }}</td></tr>
        @if($salesman)<tr><th>Salesman</th><td colspan="3">{{ $salesman->salesman_name }}</td></tr>@endif
    </table>

    <table>
        <tr><td colspan="2" class="section">Accounting totals</td></tr>
        @if($audience === 'salesman')
            <tr><th>Total sale</th><td class="money">${{ number_format($salesmanTotals['total_sale'], 2) }}</td></tr>
            <tr><th>Received</th><td class="money">${{ number_format($salesmanTotals['received'], 2) }}</td></tr>
            <tr><th>Project balance</th><td class="money">${{ number_format($salesmanTotals['project_balance'], 2) }}</td></tr>
            <tr><th>Expenses</th><td class="money">${{ number_format($salesmanTotals['expenses'], 2) }}</td></tr>
            <tr><th>Open Invoices</th><td class="money">${{ number_format($salesmanTotals['open_invoices'], 2) }}</td></tr>
            <tr><th>Lead cost</th><td class="money">${{ number_format($salesmanTotals['lead_cost'] + $salesmanTotals['change_order_lead_cost'], 2) }}</td></tr>
            <tr><th>Gross Profit</th><td class="money">${{ number_format($salesmanTotals['gross_profit'], 2) }}</td></tr>
            <tr><th>Salesman commission (50%)</th><td class="money">${{ number_format($salesmanTotals['commission_due'], 2) }}</td></tr>
            <tr><th>Commission paid</th><td class="money">${{ number_format($salesmanTotals['commission_paid'], 2) }}</td></tr>
            <tr class="total"><th>Commission balance</th><td class="money">${{ number_format($salesmanTotals['commission_balance'], 2) }}</td></tr>
        @else
            <tr><th>Sale amount</th><td class="money">${{ number_format($officeTotals['sale_amount'], 2) }}</td></tr>
            <tr><th>Total receivables</th><td class="money">${{ number_format($officeTotals['receivables'], 2) }}</td></tr>
            <tr><th>Project balance</th><td class="money">${{ number_format($officeTotals['balance'], 2) }}</td></tr>
            <tr><th>Expenses</th><td class="money">${{ number_format($officeTotals['expenses'], 2) }}</td></tr>
            <tr><th>Open Invoices</th><td class="money">${{ number_format($officeTotals['open_invoices'], 2) }}</td></tr>
            <tr><th>Lead Cost</th><td class="money">${{ number_format($officeTotals['lead_cost'], 2) }}</td></tr>
            <tr><th>Gross Profit</th><td class="money">${{ number_format($officeTotals['gross_profit'], 2) }}</td></tr>
            <tr><th>Office commission (50%)</th><td class="money">${{ number_format($officeTotals['office_commission'], 2) }}</td></tr>
            <tr><th>Salesman commission (50%)</th><td class="money">${{ number_format($officeTotals['salesman_commission'], 2) }}</td></tr>
            <tr><th>Commission paid</th><td class="money">${{ number_format($officeTotals['commission_paid'], 2) }}</td></tr>
            <tr class="total"><th>Net received</th><td class="money">${{ number_format($officeTotals['net'], 2) }}</td></tr>
        @endif
    </table>
    <table class="signatures"><tr><td>Customer signature / date</td><td>Representative signature / date</td></tr><tr><td colspan="2">Completion notes</td></tr></table>
    <div class="footer">Generated {{ now('America/Los_Angeles')->format('m/d/Y g:i A T') }}</div>
</body>
</html>
