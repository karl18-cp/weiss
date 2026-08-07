<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\Lead;
use App\Models\LeadNote;
use App\Services\WebPushService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SalesmanPortalController extends Controller
{
    public function leads(Request $request): Response
    {
        $user = $request->user();
        abort_unless($user?->role === 'salesman', 403);

        $salesmanId = $user->salesman?->salesman_id;
        abort_unless($salesmanId, 403, 'Your account is not linked to a salesman profile.');

        $leads = $this->assignedLeadsQuery($salesmanId)
            ->select([
                'id',
                'customer_name',
                'primary_number',
                'mobile_number',
                'address',
                'city',
                'state',
                'zip_code',
                'appointment_at',
                'company_id',
                'product_id',
            ])
            ->with([
                'company:com_id,company',
                'product:prod_id,product_name',
            ])
            ->orderByRaw('appointment_at IS NULL')
            ->orderBy('appointment_at')
            ->orderByDesc('id')
            ->get();

        return Inertia::render('salesman/leads', [
            'leads' => $leads,
            'salesman' => [
                'id' => $salesmanId,
                'name' => $user->salesman->salesman_name,
            ],
            'pushPublicKey' => config('services.webpush.public_key'),
        ]);
    }

    public function leadInformation(Request $request): Response
    {
        $user = $request->user();
        abort_unless($user?->role === 'salesman', 403);

        $salesmanId = $user->salesman?->salesman_id;
        abort_unless($salesmanId, 403, 'Your account is not linked to a salesman profile.');

        $requestedLeadId = $request->integer('lead');
        $leadQuery = $this->assignedLeadsQuery($salesmanId)
            ->select([
                'id',
                'customer_name',
                'primary_number',
                'mobile_number',
                'address',
                'city',
                'state',
                'zip_code',
                'appointment_at',
                'company_id',
                'product_id',
            ])
            ->with([
                'company:com_id,company',
                'product:prod_id,product_name',
                'notes' => fn ($query) => $query
                    ->where('note_type', 'dispatch')
                    ->latest()
                    ->limit(1),
            ])
            ->orderByRaw('appointment_at IS NULL')
            ->orderBy('appointment_at')
            ->orderByDesc('id');

        $lead = $requestedLeadId
            ? (clone $leadQuery)->whereKey($requestedLeadId)->first()
            : $leadQuery->first();

        if ($requestedLeadId) {
            abort_unless($lead, 404);
        }

        return Inertia::render('salesman/lead-information', [
            'lead' => $lead,
            'dispatchNote' => $lead?->notes->first()?->body,
            'salesman' => [
                'id' => $salesmanId,
                'name' => $user->salesman->salesman_name,
            ],
        ]);
    }

    public function storeAppointmentResultNote(Request $request, Lead $lead, WebPushService $push): RedirectResponse
    {
        $user = $request->user();
        abort_unless($user?->role === 'salesman', 403);

        $salesmanId = $user->salesman?->salesman_id;
        abort_unless($salesmanId, 403, 'Your account is not linked to a salesman profile.');
        abort_unless(
            $lead->salesman_1_id === $salesmanId || $lead->salesman_2_id === $salesmanId,
            403
        );

        $validated = $request->validate([
            'body' => ['nullable', 'required_without:action', 'string', 'max:5000'],
            'action' => ['nullable', 'required_without:body', 'string', 'in:on_my_way,sold,not_sold'],
        ]);

        $actionLabels = [
            'on_my_way' => 'On My Way',
            'sold' => 'Sold',
            'not_sold' => 'Not Sold',
        ];
        $action = $validated['action'] ?? null;
        $body = $action !== null
            ? $actionLabels[$action]
            : trim((string) ($validated['body'] ?? ''));

        LeadNote::query()->create([
            'lead_id' => $lead->id,
            'note_type' => 'appointment_result',
            'body' => $body,
            'created_by' => $user->getAuthIdentifier(),
        ]);

        if ($action !== null) {
            $salesmanName = $user->salesman->salesman_name;
            $title = "{$salesmanName}: {$actionLabels[$action]}";
            $notificationBody = "{$lead->customer_name} — {$lead->address}, {$lead->city}";

            Account::query()
                ->whereIn('role', ['admin', 'manager'])
                ->pluck('acc_id')
                ->each(fn (int $accountId) => $push->sendToAccount(
                    $accountId,
                    $title,
                    $notificationBody,
                    "/lead-workflow/dispatch-leads?lead={$lead->id}",
                ));
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $action !== null
                ? "{$actionLabels[$action]} status sent to managers and admins."
                : 'Appointment result note saved.',
        ]);

        return back();
    }

    private function assignedLeadsQuery(int $salesmanId): Builder
    {
        return Lead::query()->where(function ($query) use ($salesmanId): void {
            $query->where('salesman_1_id', $salesmanId)
                ->orWhere('salesman_2_id', $salesmanId);
        });
    }
}
