<?php

namespace App\Http\Controllers;

use App\Models\PushSubscription;
use App\Services\WebPushService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class SalesmanPushSubscriptionController extends Controller
{
    private function ensureAllowedRole(Request $request): void
    {
        abort_unless(in_array($request->user()?->role, ['admin', 'manager', 'salesman'], true), 403);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureAllowedRole($request);

        $data = $request->validate([
            'endpoint' => ['required', 'url', 'max:2048'],
            'keys.p256dh' => ['required', 'string', 'max:512'],
            'keys.auth' => ['required', 'string', 'max:512'],
        ]);

        PushSubscription::query()->updateOrCreate(
            ['endpoint' => $data['endpoint']],
            [
                'account_id' => $request->user()->getAuthIdentifier(),
                'public_key' => $data['keys']['p256dh'],
                'auth_token' => $data['keys']['auth'],
                'content_encoding' => 'aes128gcm',
            ],
        );

        return response()->json(['subscribed' => true]);
    }

    public function destroy(Request $request): Response
    {
        $this->ensureAllowedRole($request);

        $data = $request->validate(['endpoint' => ['required', 'url', 'max:2048']]);
        PushSubscription::query()
            ->where('account_id', $request->user()->getAuthIdentifier())
            ->where('endpoint', $data['endpoint'])
            ->delete();

        return response()->noContent();
    }

    public function test(Request $request, WebPushService $push): JsonResponse
    {
        $this->ensureAllowedRole($request);

        $push->sendToAccount(
            $request->user()->getAuthIdentifier(),
            'Weiss CRM notifications are ready',
            $request->user()->role === 'salesman'
                ? 'You will receive updates for your assigned appointments.'
                : 'You will receive salesman appointment status updates.',
            $request->user()->role === 'salesman' ? '/salesman/booking-board' : '/dashboard',
        );

        return response()->json(['sent' => true]);
    }
}
