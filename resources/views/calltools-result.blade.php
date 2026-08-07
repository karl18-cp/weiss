<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title }} | Weiss CRM</title>
    <style>
        *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f4f7fb;color:#12213d;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.card{width:min(560px,100%);padding:40px;border:1px solid #dbe4f0;border-radius:24px;background:#fff;box-shadow:0 24px 70px rgba(26,51,89,.12);text-align:center}.icon{width:76px;height:76px;margin:0 auto 22px;display:grid;place-items:center;border-radius:50%;font-size:38px;font-weight:800;color:#fff;background:{{ $success ? '#159957' : '#dc3545' }}}h1{margin:0 0 12px;font-size:clamp(26px,5vw,36px)}p{margin:0;color:#66758f;font-size:17px;line-height:1.6}.lead{margin-top:22px;padding:16px;border-radius:14px;background:#f5f8fd;font-weight:700}.errors{margin-top:22px;padding:16px 18px;border-radius:14px;background:#fff3f4;color:#9f2230;text-align:left}.errors ul{margin:8px 0 0;padding-left:22px}.hint{margin-top:24px;font-size:14px}
    </style>
</head>
<body><main class="card">
    <div class="icon">{{ $success ? '✓' : '!' }}</div><h1>{{ $title }}</h1><p>{{ $message }}</p>
    @if ($leadName || $leadId)<div class="lead">{{ $leadName ?: 'Lead' }}@if($leadId) · Weiss Lead #{{ $leadId }}@endif</div>@endif
    @if (!empty($errors))<div class="errors"><strong>Please check:</strong><ul>@foreach ($errors as $messages) @foreach ((array) $messages as $error)<li>{{ $error }}</li>@endforeach @endforeach</ul></div>@endif
    <p class="hint">{{ $success ? 'You can close this page and continue working in CallTools.' : 'Correct the lead in CallTools, then send it again. If the issue continues, contact your manager.' }}</p>
</main></body></html>
