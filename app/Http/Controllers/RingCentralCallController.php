<?php

namespace App\Http\Controllers;

use App\Services\RingCentralService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Throwable;

class RingCentralCallController extends Controller
{
    public function __invoke(
        Request $request,
        RingCentralService $ringCentral,
    ): JsonResponse {
        $validated = $request->validate([
            'phone' => ['required', 'string', 'max:30', 'regex:/^[0-9+().\s-]+$/'],
        ]);

        try {
            $call = $ringCentral->ringOut($validated['phone']);
        } catch (RuntimeException $exception) {
            report($exception);

            return response()->json([
                'message' => $exception->getMessage(),
            ], str_contains($exception->getMessage(), 'not configured') ? 503 : 502);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'message' => 'The call could not be started. Please try again.',
            ], 502);
        }

        return response()->json([
            'message' => 'RingCentral is calling your phone. Answer it to connect to the customer.',
            'call_id' => data_get($call, 'id'),
            'call_status' => data_get($call, 'status.callStatus'),
            'caller_status' => data_get($call, 'status.callerStatus'),
            'callee_status' => data_get($call, 'status.calleeStatus'),
        ]);
    }
}
