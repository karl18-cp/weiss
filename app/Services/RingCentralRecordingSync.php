<?php

namespace App\Services;

use App\Models\RingCentralCall;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class RingCentralRecordingSync
{
    public function __construct(private readonly RingCentralService $ringCentral) {}

    /** @return array{matched: int, recordings: int, checked: int} */
    public function sync(): array
    {
        // Recording downloads use RingCentral's heavy API allowance. Drain a
        // small batch per minute so a backlog cannot rate-limit new calls.
        $pendingDownloads = RingCentralCall::query()
            ->whereNotNull('recording_id')
            ->whereNull('recording_path')
            ->latest('initiated_at')
            ->limit(8)
            ->get();
        $recordings = 0;

        foreach ($pendingDownloads as $call) {
            if ($this->downloadRecording($call)) {
                $recordings++;
            }
        }

        $calls = RingCentralCall::query()
            ->where('initiated_at', '<=', now()->subSeconds(15))
            // RingCentral can add recording metadata after the completed call first
            // appears in the call log. Keep revisiting calls without archived audio
            // so a call matched too early is not permanently skipped.
            ->whereNull('recording_path')
            ->whereNull('recording_id')
            ->oldest('initiated_at')
            ->limit(500)
            ->get();

        if ($calls->isEmpty()) {
            return ['matched' => 0, 'recordings' => $recordings, 'checked' => 0];
        }

        $records = collect($this->ringCentral->callLog($calls->min('initiated_at')->copy()->subMinutes(10)))
            ->filter(fn (array $record): bool => strcasecmp((string) ($record['direction'] ?? ''), 'Outbound') === 0);
        $usedIds = RingCentralCall::query()->whereNotNull('ringcentral_call_log_id')->pluck('ringcentral_call_log_id')->all();
        $matched = 0;

        foreach ($calls as $call) {
            $record = $call->ringcentral_call_log_id
                ? $records->firstWhere('id', $call->ringcentral_call_log_id)
                : $this->match($call, $records->reject(fn (array $record): bool => in_array((string) ($record['id'] ?? ''), $usedIds, true)));

            if (! is_array($record)) {
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
            ]);
            $usedIds[] = (string) ($record['id'] ?? '');
            $matched++;

        }

        return ['matched' => $matched, 'recordings' => $recordings, 'checked' => $calls->count()];
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
                if (! is_string($phone)) return false;
                try {
                    if ($this->ringCentral->normalizePhoneNumber($phone) !== $call->normalized_phone) return false;
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
        if (is_array($record['recording'] ?? null)) return $record['recording'];
        foreach ((array) ($record['legs'] ?? []) as $leg) {
            if (is_array($leg['recording'] ?? null)) return $leg['recording'];
        }

        return null;
    }
}
