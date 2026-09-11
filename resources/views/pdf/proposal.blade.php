<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <style>
        @page { margin: 34px 38px; }
        body { margin: 0; color: #17233c; font-family: DejaVu Sans, sans-serif; font-size: 10px; line-height: 1.45; }
        .header { padding: 20px 24px; border-radius: 10px; color: #fff; background: #1f57bd; }
        .brand { font-size: 22px; font-weight: bold; } .brand small { display: block; font-size: 8px; letter-spacing: 2px; opacity: .8; }
        .proposal-title { float: right; margin-top: -38px; text-align: right; } .proposal-title b { display: block; font-size: 18px; } .proposal-title span { opacity: .85; }
        .meta { width: 100%; margin: 20px 0; border-collapse: separate; border-spacing: 8px 0; }
        .meta td { width: 50%; padding: 13px; border: 1px solid #dbe3f0; border-radius: 8px; vertical-align: top; }
        .label { display: block; margin-bottom: 4px; color: #71809a; font-size: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: .5px; }
        .items { width: 100%; border-collapse: collapse; margin: 14px 0; }
        .items th { padding: 9px 8px; color: #fff; background: #244e96; font-size: 8px; text-align: left; text-transform: uppercase; }
        .items td { padding: 9px 8px; border-bottom: 1px solid #e1e6ef; vertical-align: top; }
        .items .number { text-align: right; white-space: nowrap; } .description { color: #65738a; font-size: 8px; }
        .totals { width: 42%; margin-left: 58%; border-collapse: collapse; } .totals td { padding: 5px 8px; text-align: right; }
        .totals td:first-child { text-align: left; color: #64738b; } .totals .grand td { padding-top: 9px; border-top: 2px solid #225cc9; color: #184fae; font-size: 15px; font-weight: bold; }
        .section { margin-top: 16px; padding: 13px 15px; border: 1px solid #dce3ef; border-radius: 8px; page-break-inside: avoid; }
        .section h3 { margin: 0 0 8px; color: #2257b8; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
        .section p { margin: 0; white-space: pre-line; }
        .signatures { margin-top: 32px; width: 100%; } .signatures td { width: 47%; padding-top: 28px; border-top: 1px solid #75829a; } .signatures td+td { margin-left: 6%; }
        .footer { position: fixed; bottom: -20px; left: 0; right: 0; color: #8190a8; font-size: 8px; text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <div class="brand"><small>WEISS</small>Project Proposal</div>
        <div class="proposal-title"><b>{{ $proposal->proposal_number }}</b><span>Version {{ $version }} · {{ $proposal->status }}</span></div>
    </div>
    <table class="meta"><tr>
        <td><span class="label">Prepared for</span><strong style="font-size:14px">{{ $proposal->customer_name }}</strong><br>{{ $proposal->address }}<br>{{ collect([$proposal->city, $proposal->state, $proposal->zip_code])->filter()->join(', ') }}<br>{{ $proposal->phone }} @if($proposal->email) · {{ $proposal->email }} @endif</td>
        <td><span class="label">Proposal details</span><strong>Issue date:</strong> {{ optional($proposal->issue_date)->format('M j, Y') }}<br><strong>Valid through:</strong> {{ optional($proposal->expires_at)->format('M j, Y') ?: 'Not specified' }}<br><strong>Project:</strong> {{ $proposal->project?->project_number ?: 'Standalone proposal' }}</td>
    </tr></table>
    <table class="items"><thead><tr><th>Work item</th><th class="number">Quantity</th><th>Unit</th><th class="number">Unit price</th><th class="number">Amount</th></tr></thead><tbody>
        @foreach($proposal->items as $item)<tr><td><strong>{{ $item->name }}</strong>@if($item->description)<div class="description">{{ $item->description }}</div>@endif</td><td class="number">{{ rtrim(rtrim(number_format($item->quantity, 2), '0'), '.') }}</td><td>{{ $item->unit }}</td><td class="number">${{ number_format($item->unit_price, 2) }}</td><td class="number"><strong>${{ number_format($item->total, 2) }}</strong></td></tr>@endforeach
    </tbody></table>
    <table class="totals"><tr><td>Subtotal</td><td>${{ number_format($proposal->subtotal, 2) }}</td></tr><tr><td>Discount</td><td>-${{ number_format($proposal->discount, 2) }}</td></tr><tr><td>Tax ({{ rtrim(rtrim(number_format($proposal->tax_rate, 2), '0'), '.') }}%)</td><td>${{ number_format($proposal->tax_amount, 2) }}</td></tr><tr class="grand"><td>Total</td><td>${{ number_format($proposal->total, 2) }}</td></tr></table>
    @foreach([['Scope of work',$proposal->scope],['Exclusions',$proposal->exclusions],['Payment schedule',$proposal->payment_schedule],['Terms & conditions',$proposal->terms]] as [$title,$copy]) @if($copy)<div class="section"><h3>{{ $title }}</h3><p>{{ $copy }}</p></div>@endif @endforeach
    <table class="signatures"><tr><td>Customer signature / date</td><td>Authorized representative / date</td></tr></table>
    <div class="footer">{{ $proposal->proposal_number }} · Generated {{ now('America/Los_Angeles')->format('M j, Y g:i A T') }}</div>
</body>
</html>
