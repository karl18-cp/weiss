<?php

namespace App\Http\Controllers;

use App\Models\PushSubscription;
use App\Services\WebPushService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class SalesmanPushSubscriptionController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()?->role === 'salesman', 403);

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
        abort_unless($request->user()?->role === 'salesman', 403);

        $data = $request->validate(['endpoint' => ['required', 'url', 'max:2048']]);
        PushSubscription::query()
            ->where('account_id', $request->user()->getAuthIdentifier())
            ->where('endpoint', $data['endpoint'])
            ->delete();

        return response()->noContent();
    }

    public function test(Request $request, WebPushService $push): JsonResponse
    {
        abort_unless($request->user()?->role === 'salesman', 403);

        $push->sendToAccount(
            $request->user()->getAuthIdentifier(),
            'Weiss Sales notifications are ready',
            'You will receive updates for your assigned appointments.',
        );

        return response()->json(['sent' => true]);
    }
}
