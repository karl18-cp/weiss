<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\RingCentralCall;
use App\Services\RingCentralService;
use App\Support\PhoneNumberVisibility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Throwable;
use Illuminate\Validation\ValidationException;

class RingCentralCallIntentController extends Controller
{
    public function __invoke(Request $request, Lead $lead, RingCentralService $ringCentral): JsonResponse
    {
        $validated = $request->validate([
            'phone_slot' => ['required', 'string', 'in:primary,secondary,mobile'],
        ]);
        $user = $request->user();

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

        try {
            $ringOut = $ringCentral->ringOut($phone);
            $call->update([
                'telephony_session_id' => data_get($ringOut, 'id'),
                'result' => data_get($ringOut, 'status.callStatus', 'InProgress'),
            ]);
        } catch (RuntimeException $exception) {
            $call->update(['result' => 'Failed']);
            report($exception);

            return response()->json(
                ['message' => $exception->getMessage()],
                str_contains($exception->getMessage(), 'not configured') ? 503 : 502,
            );
        } catch (Throwable $exception) {
            $call->update(['result' => 'Failed']);
            report($exception);

            return response()->json([
                'message' => 'The call could not be started. Please try again.',
            ], 502);
        }

        return response()->json([
            'id' => $call->id,
            'dial_mode' => 'secure_ringout',
            'call_id' => data_get($ringOut, 'id'),
            'display_phone' => PhoneNumberVisibility::canView($user)
                ? $phone
                : PhoneNumberVisibility::mask($phone),
            'message' => 'RingCentral is calling your configured phone. Answer it to connect to the customer.',
            'call_status' => data_get($ringOut, 'status.callStatus', 'In progress'),
            'caller_status' => data_get($ringOut, 'status.callerStatus'),
            'callee_status' => data_get($ringOut, 'status.calleeStatus'),
        ], 201);
    }
}
