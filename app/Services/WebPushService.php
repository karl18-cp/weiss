<?php

namespace App\Services;

use App\Models\PushSubscription as PushSubscriptionModel;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Throwable;

class WebPushService
{
    public function sendToAccount(int $accountId, string $title, string $body, string $url = '/salesman/booking-board'): int
    {
        $publicKey = config('services.webpush.public_key');
        $privateKey = config('services.webpush.private_key');

        if (! $publicKey || ! $privateKey) {
            return 0;
        }

        // Push delivery is supplemental and must never prevent core CRM actions
        // (such as assigning a salesman) from being saved. The WebPush package
        // requires ext-curl and otherwise emits a warning that Laravel converts
        // into an exception during the model's updated event.
        if (! extension_loaded('curl')) {
            Log::warning('Web push skipped because the PHP curl extension is unavailable.', [
                'account_id' => $accountId,
            ]);

            return 0;
        }

        try {
            $webPush = new WebPush([
                'VAPID' => [
                    'subject' => config('services.webpush.subject', config('app.url')),
                    'publicKey' => $publicKey,
                    'privateKey' => $privateKey,
                ],
            ]);

            $payload = json_encode([
                'title' => $title,
                'body' => $body,
                'url' => $url,
                'icon' => '/pwa/icon-192.png',
                'badge' => '/pwa/icon-192.png',
            ], JSON_THROW_ON_ERROR);
        } catch (Throwable $exception) {
            Log::warning('Web push initialization failed; continuing without notification.', [
                'account_id' => $accountId,
                'exception' => $exception->getMessage(),
            ]);

            return 0;
        }

        $sent = 0;
        PushSubscriptionModel::query()
            ->where('account_id', $accountId)
            ->each(function (PushSubscriptionModel $stored) use ($webPush, $payload, &$sent): void {
                try {
                    $report = $webPush->sendOneNotification(
                        Subscription::create([
                            'endpoint' => $stored->endpoint,
                            'publicKey' => $stored->public_key,
                            'authToken' => $stored->auth_token,
                            'contentEncoding' => $stored->content_encoding,
                        ]),
                        $payload,
                    );

                    if ($report->isSubscriptionExpired()) {
                        $stored->delete();
                    } elseif ($report->isSuccess()) {
                        $sent++;
                    }
                } catch (Throwable $exception) {
                    report($exception);
                }
            });

        return $sent;
    }
}
