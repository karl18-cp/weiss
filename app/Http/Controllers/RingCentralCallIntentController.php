<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\RingCentralCall;
use App\Services\RingCentralService;
use App\Support\ManagerAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class RingCentralCallIntentController extends Controller
{
    public function __invoke(Request $request, Lead $lead, RingCentralService $ringCentral): JsonResponse
    {
        $validated = $request->validate([
            'phone_slot' => ['required', 'string', 'in:primary,secondary,mobile'],
        ]);
        $user = $request->user();

        if (
            ManagerAccess::hasEnabledFlag($user, 'dial_raw_only')
            && ! in_array($lead->status, ['raw', 'verify'], true)
        ) {
            throw ValidationException::withMessages([
                'phone_slot' => 'Your dialing permission is limited to Raw and Verify leads. Move or select a Raw or Verify lead before dialing.',
            ]);
        }

        if ($user?->role === 'salesman') {
            $salesmanId = $user->salesman?->salesman_id;
            abort_unless(
                $salesmanId && in_array((int) $salesmanId, [
                    (int) $lead->salesman_1_id,
                    (int) $lead->salesman_2_id,
                ], true),
                404,
            );
        }

        $field = match ($validated['phone_slot']) {
            'primary' => 'primary_number',
            'secondary' => 'secondary_number',
            'mobile' => 'mobile_number',
        };
        $phone = $lead->getRawOriginal($field) ?: $lead->{$field};

        if (! is_string($phone) || blank($phone)) {
            throw ValidationException::withMessages([
                'phone_slot' => 'This phone number is not available on the selected lead.',
            ]);
        }

        $normalized = $ringCentral->normalizePhoneNumber($phone);
        $call = RingCentralCall::query()->create([
            'lead_id' => $lead->id,
            'account_id' => $user->getAuthIdentifier(),
            'phone_number' => $phone,
            'normalized_phone' => $normalized,
            'direction' => 'Outbound',
            'initiated_at' => now()->utc(),
        ]);

        return response()->json([
            'id' => $call->id,
            'dial_mode' => 'browser_widget',
            'phone' => $phone,
        ], 201);
    }
}
