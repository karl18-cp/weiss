<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\RingCentralCall;
use App\Services\RingCentralService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class RingCentralCallIntentController extends Controller
{
    public function __invoke(Request $request, Lead $lead, RingCentralService $ringCentral): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string', 'max:30', 'regex:/^[0-9+().\s-]+$/'],
        ]);
        $normalized = $ringCentral->normalizePhoneNumber($validated['phone']);
        $leadPhones = collect([$lead->primary_number, $lead->secondary_number, $lead->mobile_number])
            ->filter()
            ->map(fn (string $phone): string => $ringCentral->normalizePhoneNumber($phone));

        if (! $leadPhones->contains($normalized)) {
            throw ValidationException::withMessages(['phone' => 'This number is not saved on the selected lead.']);
        }

        $call = RingCentralCall::query()->create([
            'lead_id' => $lead->id,
            'account_id' => $request->user()->getAuthIdentifier(),
            'phone_number' => $validated['phone'],
            'normalized_phone' => $normalized,
            'direction' => 'Outbound',
            'initiated_at' => now()->utc(),
        ]);

        return response()->json(['id' => $call->id], 201);
    }
}
