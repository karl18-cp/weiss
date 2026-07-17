<?php

namespace App\Http\Controllers;

use App\Services\RingCentralService;
use Illuminate\Http\JsonResponse;
use RuntimeException;
use Throwable;

class RingCentralCallStatusController extends Controller
{
    public function __invoke(
        string $callId,
        RingCentralService $ringCentral,
    ): JsonResponse {
        try {
            $call = $ringCentral->ringOutStatus($callId);
        } catch (RuntimeException $exception) {
            report($exception);

            return response()->json([
                'message' => $exception->getMessage(),
            ], 502);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'message' => 'The call status could not be read.',
            ], 502);
        }

        return response()->json([
            'call_id' => data_get($call, 'id'),
            'call_status' => data_get($call, 'status.callStatus'),
            'caller_status' => data_get($call, 'status.callerStatus'),
            'callee_status' => data_get($call, 'status.calleeStatus'),
        ]);
    }
}
