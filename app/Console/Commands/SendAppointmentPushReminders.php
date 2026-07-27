<?php

namespace App\Console\Commands;

use App\Models\Lead;
use App\Models\PushNotificationLog;
use App\Models\PushSubscription;
use App\Models\Salesman;
use App\Services\WebPushService;
use Illuminate\Console\Command;

class SendAppointmentPushReminders extends Command
{
    protected $signature = 'push:appointment-reminders';

    protected $description = 'Send same-day, upcoming, and due appointment push reminders';

    public function handle(WebPushService $push): int
    {
        $now = now();
        $leads = Lead::query()
            ->whereNotNull('appointment_at')
            ->whereBetween('appointment_at', [$now->copy()->startOfDay(), $now->copy()->endOfDay()])
            ->where(fn ($query) => $query
                ->whereNotNull('salesman_1_id')
                ->orWhereNotNull('salesman_2_id'))
            ->get();

        foreach ($leads as $lead) {
            $appointment = $lead->appointment_at;
            $minutesUntil = $now->diffInMinutes($appointment, false);
            $types = ['today'];

            if ($minutesUntil >= 0 && $minutesUntil <= 30) {
                $types[] = 'upcoming';
            }
            if ($minutesUntil >= -2 && $minutesUntil <= 2) {
                $types[] = 'due';
            }

            $this->notifyLead($push, $lead, $types);
        }

        return self::SUCCESS;
    }

    /** @param array<int, string> $types */
    private function notifyLead(WebPushService $push, Lead $lead, array $types): void
    {
        $salesmanIds = array_values(array_unique(array_filter([
            $lead->salesman_1_id,
            $lead->salesman_2_id,
        ])));
        $accounts = Salesman::query()
            ->whereIn('salesman_id', $salesmanIds)
            ->whereNotNull('account_id')
            ->pluck('account_id');

        foreach ($accounts as $accountId) {
            if (! PushSubscription::query()->where('account_id', $accountId)->exists()) {
                continue;
            }

            foreach ($types as $type) {
                $alreadySent = PushNotificationLog::query()
                    ->where('lead_id', $lead->id)
                    ->where('account_id', $accountId)
                    ->where('notification_type', $type)
                    ->where('appointment_at', $lead->appointment_at)
                    ->exists();

                if ($alreadySent) {
                    continue;
                }

                [$title, $body] = $this->message($type, $lead);
                $sent = $push->sendToAccount(
                    (int) $accountId,
                    $title,
                    $body,
                    "/salesman/leads?lead={$lead->id}",
                );
                if ($sent === 0) {
                    continue;
                }

                PushNotificationLog::query()->create([
                    'lead_id' => $lead->id,
                    'account_id' => $accountId,
                    'notification_type' => $type,
                    'appointment_at' => $lead->appointment_at,
                    'sent_at' => now(),
                ]);
            }
        }
    }

    /** @return array{string, string} */
    private function message(string $type, Lead $lead): array
    {
        $time = $lead->appointment_at->format('g:i A');

        return match ($type) {
            'due' => ['Appointment time', "{$lead->customer_name} is scheduled now."],
            'upcoming' => ['Appointment in 30 minutes', "{$lead->customer_name} at {$time}."],
            default => ['Appointment today', "{$lead->customer_name} at {$time}."],
        };
    }
}
