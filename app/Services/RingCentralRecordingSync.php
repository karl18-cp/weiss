<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Lead;
use App\Models\RingCentralCall;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class RingCentralRecordingSync
{
    public function __construct(private readonly RingCentralService $ringCentral) {}

    /** @return array{imported: int, matched: int, recordings: int, checked: int} */
    public function sync(?CarbonInterface $from = null, ?CarbonInterface $to = null, int $downloadLimit = 20): array
    {
        $imported = 0;
        $recordings = 0;
        $matched = 0;
        $checked = 0;

        if ((bool) config('services.ringcentral.import_call_logs', true)) {
            $importResult = $this->importCallLogs(
                $from ?? now()->utc()->subHours((int) config('services.ringcentral.import_window_hours', 48)),
                $to ?? now()->utc(),
                $recordings,
                $downloadLimit,
            );
            $imported = $importResult['imported'];
            $matched += $importResult['matched'];
            $checked += $importResult['checked'];
        }

        $pendingQuery = RingCentralCall::query()
            // Call timestamps are persisted in UTC even though the CRM's
            // display timezone is America/Los_Angeles.
            ->where('initiated_at', '<=', now()->utc()->subSeconds(15))
            ->whereNull('matched_at');
        $backfillRun = now()->minute % 10 === 0;
        $calls = (clone $pendingQuery)
            // Unchecked calls come first. Previously the same unmatched rows
            // occupied every batch and prevented the rest of the queue from
            // ever being compared with RingCentral.
            ->orderByRaw('sync_checked_at is not null')
            ->orderBy('sync_checked_at')
            ->when(
                $backfillRun,
                fn ($query) => $query->oldest('initiated_at'),
                fn ($query) => $query->latest('initiated_at'),
            )
            ->limit($backfillRun ? 100 : 200)
            ->get();

        if ($calls->isNotEmpty()) {
            $usedIds = RingCentralCall::query()->whereNotNull('ringcentral_call_log_id')->pluck('ringcentral_call_log_id')->all();
            $result = $this->syncBatchSafely(
                $calls,
                $usedIds,
                $recordings,
                $downloadLimit,
                'unmatched-calls',
            );
            $matched += $result['matched'];
            $checked += $result['checked'];
        }

        // RingCentral commonly publishes a completed call-log row before its
        // recording metadata is ready. Those calls used to be marked matched
        // and were therefore never inspected again, leaving the CRM stuck on
        // "Waiting for RingCentral" forever. Revisit a small, recent batch
        // until the recording ID appears, without hammering the API every
        // minute for the same call.
        $recordingMetadataCalls = RingCentralCall::query()
            ->whereNotNull('matched_at')
            ->whereNotNull('ringcentral_call_log_id')
            ->whereNull('recording_id')
            ->where('initiated_at', '>=', $from?->copy()->utc() ?? now()->utc()->subDays(90))
            ->where(function ($query): void {
                $query->whereNull('sync_checked_at')
                    ->orWhere('sync_checked_at', '<=', now()->utc()->subMinutes(5));
            })
            ->latest('initiated_at')
            ->limit(50)
            ->get();

        if ($recordingMetadataCalls->isNotEmpty()) {
            $usedIds ??= RingCentralCall::query()
                ->whereNotNull('ringcentral_call_log_id')
                ->pluck('ringcentral_call_log_id')
                ->all();
            $result = $this->syncBatchSafely(
                $recordingMetadataCalls,
                $usedIds,
                $recordings,
                $downloadLimit,
                'recording-metadata',
            );
            $matched += $result['matched'];
            $checked += $result['checked'];
        }

        if ($recordings < $downloadLimit) {
            $pendingDownloads = RingCentralCall::query()
                ->whereNotNull('recording_id')
                ->whereNull('recording_path')
                ->latest('initiated_at')
                ->limit($downloadLimit - $recordings)
                ->get();

            foreach ($pendingDownloads as $call) {
                if ($this->downloadRecording($call)) {
                    $recordings++;
                }
            }
        }

        return [
            'imported' => $imported,
            'matched' => $matched,
            'recordings' => $recordings,
            'checked' => $checked,
        ];
    }

    /** @return array{imported: int, matched: int, checked: int} */
    private function importCallLogs(CarbonInterface $from, CarbonInterface $to, int &$recordings, int $downloadLimit): array
    {
        try {
            $records = collect($this->ringCentral->callLog($from, $to))
                ->filter(fn (array $record): bool => strcasecmp((string) ($record['direction'] ?? ''), 'Outbound') === 0)
                ->filter(fn (array $record): bool => filled($record['id'] ?? null));
        } catch (\Throwable $exception) {
            Log::warning('RingCentral account call-log import failed.', [
                'from' => $from->toIso8601String(),
                'to' => $to->toIso8601String(),
                'error' => $exception->getMessage(),
            ]);

            return ['imported' => 0, 'matched' => 0, 'checked' => 0];
        }

        if ($records->isEmpty()) {
            return ['imported' => 0, 'matched' => 0, 'checked' => 0];
        }

        $phoneMap = [];
        Lead::query()->select(['id', 'created_by', 'primary_number', 'secondary_number', 'mobile_number'])
            ->chunkById(500, function ($leads) use (&$phoneMap): void {
                foreach ($leads as $lead) {
                    foreach (['primary_number', 'secondary_number', 'mobile_number'] as $field) {
                        if (! filled($lead->{$field})) {
                            continue;
                        }
                        try {
                            $phoneMap[$this->ringCentral->normalizePhoneNumber((string) $lead->{$field})] = $lead;
                        } catch (\Throwable) {
                            // Ignore malformed legacy phone values.
                        }
                    }
                }
            });

        $fallbackAccountId = Account::query()->where('role', 'admin')->value('acc_id')
            ?? Account::query()->value('acc_id');
        if (! $fallbackAccountId) {
            return ['imported' => 0, 'matched' => 0, 'checked' => $records->count()];
        }

        $imported = 0;
        $matched = 0;
        foreach ($records as $record) {
            $phone = data_get($record, 'to.phoneNumber') ?? data_get($record, 'to.phoneNumberInfo.phoneNumber');
            if (! is_string($phone)) {
                continue;
            }
            try {
                $normalized = $this->ringCentral->normalizePhoneNumber($phone);
            } catch (\Throwable) {
                continue;
            }
            $lead = $phoneMap[$normalized] ?? null;
            if (! $lead) {
                continue;
            }

            $logId = (string) $record['id'];
            $startedAt = isset($record['startTime']) ? CarbonImmutable::parse($record['startTime'])->utc() : now()->utc();
            $duration = max(0, (int) ($record['duration'] ?? 0));
            $recording = $this->recordingMetadata($record);
            $call = RingCentralCall::query()->where('ringcentral_call_log_id', $logId)->first();
            if (! $call) {
                $call = RingCentralCall::query()
                    ->where('lead_id', $lead->id)
                    ->whereNull('ringcentral_call_log_id')
                    ->whereBetween('initiated_at', [$startedAt->subMinutes(15), $startedAt->addMinutes(15)])
                    ->get()
                    ->sortBy(fn (RingCentralCall $candidate): int => abs(
                        ($candidate->initiated_at?->getTimestamp() ?? 0) - $startedAt->getTimestamp()
                    ))
                    ->first();
            }
            $call ??= new RingCentralCall();
            $wasNew = ! $call->exists;
            $call->fill([
                'ringcentral_call_log_id' => $logId,
                'lead_id' => $lead->id,
                'account_id' => $call->account_id ?: ($lead->created_by ?: $fallbackAccountId),
                'phone_number' => $phone,
                'normalized_phone' => $normalized,
                'direction' => 'Outbound',
                'telephony_session_id' => $record['telephonySessionId'] ?? $record['sessionId'] ?? $call->telephony_session_id,
                'result' => $record['result'] ?? $record['action'] ?? 'Completed',
                'duration_seconds' => $duration,
                'recording_id' => $recording['id'] ?? $call->recording_id,
                'initiated_at' => $call->initiated_at ?: $startedAt,
                'started_at' => $startedAt,
                'ended_at' => $startedAt->addSeconds($duration),
                'matched_at' => now()->utc(),
                'sync_checked_at' => now()->utc(),
            ])->save();
            $imported += $wasNew ? 1 : 0;
            $matched++;

            if ($call->recording_id && ! $call->recording_path && $recordings < $downloadLimit && $this->downloadRecording($call)) {
                $recordings++;
            }
        }

        return ['imported' => $imported, 'matched' => $matched, 'checked' => $records->count()];
    }

    /** @return array{matched: int, checked: int} */
    private function syncBatchSafely(
        $calls,
        array &$usedIds,
        int &$recordings,
        int $downloadLimit,
        string $queue,
    ): array {
        try {
            return $this->syncBatch($calls, $usedIds, $recordings, $downloadLimit);
        } catch (\Throwable $exception) {
            // One transient API/DNS failure must not prevent the independent
            // metadata and download queues from making progress.
            Log::warning('RingCentral call-log sync batch failed.', [
                'queue' => $queue,
                'calls' => $calls->count(),
                'error' => $exception->getMessage(),
            ]);

            return ['matched' => 0, 'checked' => 0];
        }
    }

    /** @return array{matched: int, checked: int} */
    private function syncBatch($calls, array &$usedIds, int &$recordings, int $downloadLimit): array
    {
        if ($calls->isEmpty()) {
            return ['matched' => 0, 'checked' => 0];
        }

        // Keep the RingCentral query close to this batch. Asking from an old
        // pending call through "now" can exceed the API's 1,000-row page and
        // silently omit the exact records this batch needs.
        $records = collect($this->ringCentral->callLog(
            $calls->min('initiated_at')->copy()->subMinutes(10),
            $calls->max('initiated_at')->copy()->addMinutes(10),
        ))
            ->filter(fn (array $record): bool => strcasecmp((string) ($record['direction'] ?? ''), 'Outbound') === 0);
        $matched = 0;

        foreach ($calls as $call) {
            $record = $call->ringcentral_call_log_id
                ? $records->firstWhere('id', $call->ringcentral_call_log_id)
                : $this->match($call, $records->reject(fn (array $record): bool => in_array((string) ($record['id'] ?? ''), $usedIds, true)));

            if (! is_array($record)) {
                $call->update(['sync_checked_at' => now()->utc()]);

                continue;
            }

            $recording = $this->recordingMetadata($record);
            $startedAt = isset($record['startTime']) ? CarbonImmutable::parse($record['startTime'])->utc() : $call->initiated_at;
            $duration = max(0, (int) ($record['duration'] ?? 0));
            $call->update([
                'telephony_session_id' => $record['telephonySessionId'] ?? $record['sessionId'] ?? null,
                'ringcentral_call_log_id' => $record['id'] ?? null,
                'result' => $record['result'] ?? $record['action'] ?? 'Completed',
                'duration_seconds' => $duration,
                'recording_id' => $recording['id'] ?? $call->recording_id,
                'started_at' => $startedAt,
                'ended_at' => $startedAt->addSeconds($duration),
                'matched_at' => now()->utc(),
                'sync_checked_at' => now()->utc(),
            ]);
            $usedIds[] = (string) ($record['id'] ?? '');
            $matched++;

            if ($call->recording_id && $recordings < $downloadLimit && $this->downloadRecording($call)) {
                $recordings++;
            }
        }

        return ['matched' => $matched, 'checked' => $calls->count()];
    }

    private function downloadRecording(RingCentralCall $call): bool
    {
        try {
            $audio = $this->ringCentral->recording((string) $call->recording_id);
            $extension = str_contains(strtolower($audio['content_type']), 'wav') ? 'wav' : 'mp3';
            $recordedAt = $call->started_at ?? $call->initiated_at;
            $path = 'ringcentral-recordings/'.$recordedAt->format('Y/m').'/'.$call->id.'.'.$extension;
            Storage::disk('local')->put($path, $audio['body']);
            $call->update([
                'recording_path' => $path,
                'recording_content_type' => $audio['content_type'],
                'recorded_at' => now()->utc(),
            ]);

            return true;
        } catch (\Throwable $exception) {
            Log::warning('RingCentral recording download failed.', [
                'ringcentral_call_id' => $call->id,
                'recording_id' => $call->recording_id,
                'error' => $exception->getMessage(),
            ]);

            return false;
        }
    }

    private function match(RingCentralCall $call, $records): ?array
    {
        return $records
            ->filter(function (array $record) use ($call): bool {
                $phone = data_get($record, 'to.phoneNumber') ?? data_get($record, 'to.phoneNumberInfo.phoneNumber');
                if (! is_string($phone)) {
                    return false;
                }
                try {
                    if ($this->ringCentral->normalizePhoneNumber($phone) !== $call->normalized_phone) {
                        return false;
                    }
                    $startedAt = CarbonImmutable::parse($record['startTime'] ?? null);
                } catch (\Throwable) {
                    return false;
                }

                return abs($startedAt->diffInSeconds($call->initiated_at, false)) <= 900;
            })
            ->sortBy(fn (array $record): int => abs(CarbonImmutable::parse($record['startTime'])->diffInSeconds($call->initiated_at, false)))
            ->first();
    }

    private function recordingMetadata(array $record): ?array
    {
        if (is_array($record['recording'] ?? null)) {
            return $record['recording'];
        }
        foreach ((array) ($record['legs'] ?? []) as $leg) {
            if (is_array($leg['recording'] ?? null)) {
                return $leg['recording'];
            }
        }

        return null;
    }
}
