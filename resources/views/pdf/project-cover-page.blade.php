<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 24px 30px; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #111; font-family: DejaVu Sans, sans-serif; font-size: 9px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        td, th { border: 1px solid #111; padding: 5px 7px; vertical-align: top; }
        .title { padding: 9px; color: #fff; background: #203864; font-size: 19px; font-weight: bold; text-align: center; }
        .label { display: block; margin-bottom: 3px; color: #555; font-size: 7px; font-weight: bold; letter-spacing: .25px; text-transform: uppercase; }
        .value { font-size: 10px; font-weight: bold; }
        .field { height: 41px; }
        .summary-label { color: #fff; background: #4472c4; font-weight: bold; text-align: center; }
        .money { height: 34px; color: #17365d; background: #ddebf7; font-size: 13px; font-weight: bold; text-align: center; vertical-align: middle; }
        .profit { color: #fff; background: #70ad47; }
        .section { padding: 5px 7px; color: #fff; background: #203864; font-weight: bold; text-transform: uppercase; }
        .description { height: 58px; white-space: pre-line; }
        .contractors th { color: #fff; background: #4472c4; font-size: 8px; }
        .contractors td { height: 24px; vertical-align: middle; }
        .contractors .amount { text-align: right; }
        .notes { height: 92px; white-space: pre-line; }
        .footer { margin-top: 5px; color: #666; font-size: 7px; text-align: right; }
    </style>
</head>
<body>
    <div class="title">{{ strtoupper($project->lead?->company?->company ?? 'SBH CONSTRUCTION INC.') }}</div>
    <table>
        <colgroup><col style="width:20%"><col style="width:20%"><col style="width:20%"><col style="width:20%"><col style="width:20%"></colgroup>
        <tr>
            <td colspan="3" class="field"><span class="label">Job #</span><span class="value">{{ $project->project_number ?: '—' }}</span></td>
            <td colspan="2" class="field"><span class="label">Date sold</span><span class="value">{{ $dateSold ? $dateSold->format('m/d/Y') : '—' }}</span></td>
        </tr>
        <tr>
            <td colspan="3" class="field"><span class="label">Customer's name (Last, First and Middle)</span><span class="value">{{ $project->lead?->customer_name ?: '—' }}</span></td>
            <td class="summary-label">Total Income</td><td class="money">${{ number_format($income, 2) }}</td>
        </tr>
        <tr>
            <td colspan="3" class="field"><span class="label">Job address (Number, Street, and apt. or suite no.)</span><span class="value">{{ $project->lead?->address ?: '—' }}</span></td>
            <td class="summary-label">Total Expense</td><td class="money">${{ number_format($expenses, 2) }}</td>
        </tr>
        <tr>
            <td colspan="3" class="field"><span class="label">City, State, ZIP</span><span class="value">{{ collect([$project->lead?->city, $project->lead?->state, $project->lead?->zip_code])->filter()->join(', ') ?: '—' }}</span></td>
            <td class="summary-label">Profit &amp; Loss</td><td class="money profit">${{ number_format($profitLoss, 2) }}</td>
        </tr>
        <tr>
            <td colspan="2" class="field"><span class="label">Home phone #</span><span class="value">{{ $project->lead?->primary_number ?: '—' }}</span></td>
            <td class="field"><span class="label">Mobile #</span><span class="value">{{ $project->lead?->mobile_number ?: '—' }}</span></td>
            <td class="summary-label">Sale Amount</td><td class="money">${{ number_format($saleAmount, 2) }}</td>
        </tr>
        <tr>
            <td colspan="3" class="field"><span class="label">Email</span><span class="value">{{ $project->lead?->email ?: '—' }}</span></td>
            <td class="field"><span class="label">Start date</span><span class="value">{{ $project->lead?->appointment_at ? $project->lead->appointment_at->format('m/d/Y') : '—' }}</span></td>
            <td class="field"><span class="label">Finance</span><span class="value">${{ number_format($finance, 2) }}</span></td>
        </tr>
        <tr><td colspan="5" class="section">Job Description</td></tr>
        <tr><td colspan="5" class="description"><span class="value">{{ $project->lead?->product?->product_name ?: '—' }}</span></td></tr>
        <tr>
            <td colspan="3" class="field"><span class="label">Sale rep</span><span class="value">{{ $salesRepresentatives ?: '—' }}</span></td>
            <td colspan="2" class="field"><span class="label">Project Mgr</span><span class="value">{{ $project->manager?->manager_name ?: '—' }}</span></td>
        </tr>
    </table>
    <table class="contractors">
        <colgroup><col style="width:25%"><col style="width:15%"><col style="width:16%"><col style="width:17%"><col style="width:27%"></colgroup>
        <thead><tr><th>Contractor</th><th>Date</th><th>Bid</th><th>Invoice #</th><th>Note</th></tr></thead>
        <tbody>
            @for($index = 0; $index < 10; $index++)
                @php($row = $contractorRows->get($index))
                <tr>
                    <td>{{ $row['contractor'] ?? '' }}</td>
                    <td>{{ !empty($row['date']) ? $row['date']->format('m/d/Y') : '' }}</td>
                    <td class="amount">{{ isset($row['bid']) ? '$'.number_format($row['bid'], 2) : '' }}</td>
                    <td>{{ $row['invoice'] ?? '' }}</td>
                    <td>{{ $row['note'] ?? '' }}</td>
                </tr>
            @endfor
        </tbody>
    </table>
    <table><tr><td class="notes"><span class="label">Notes</span>{{ $project->manual_notes ?: $project->lead?->notes?->pluck('body')->take(4)->join("\n") }}</td></tr></table>
    <div class="footer">Generated {{ now('America/Los_Angeles')->format('m/d/Y g:i A T') }}</div>
</body>
</html>
