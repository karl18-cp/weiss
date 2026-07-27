<?php

namespace App\Services;

use App\Models\PushSubscription as PushSubscriptionModel;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Throwable;

class WebPushService
{
    public function sendToAccount(int $accountId, string $title, string $body, string $url = '/salesman/booking-board'): void
    {
        $publicKey = config('services.webpush.public_key');
        $privateKey = config('services.webpush.private_key');

        if (! $publicKey || ! $privateKey) {
            return;
        }

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

        PushSubscriptionModel::query()
            ->where('account_id', $accountId)
            ->each(function (PushSubscriptionModel $stored) use ($webPush, $payload): void {
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
                    }
                } catch (Throwable $exception) {
                    report($exception);
                }
            });
    }
}
