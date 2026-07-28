<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\LeadNote;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
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

        $leads = Lead::query()
            ->where(function ($query) use ($salesmanId): void {
                $query->where('salesman_1_id', $salesmanId)
                    ->orWhere('salesman_2_id', $salesmanId);
            })
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

    public function storeAppointmentResultNote(Request $request, Lead $lead): RedirectResponse
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
            'body' => ['required', 'string', 'max:5000'],
        ]);

        LeadNote::query()->create([
            'lead_id' => $lead->id,
            'note_type' => 'appointment_result',
            'body' => $validated['body'],
            'created_by' => $user->getAuthIdentifier(),
        ]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Appointment result note saved.',
        ]);

        return back();
    }
}
