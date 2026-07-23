<?php

namespace App\Services;

use App\Models\RingCentralCall;
use Carbon\CarbonImmutable;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Storage;

class RingCentralRecordingSync
{
    public function __construct(private readonly RingCentralService $ringCentral) {}

    /** @return array{matched: int, recordings: int, checked: int} */
    public function sync(): array
    {
        $calls = RingCentralCall::query()
            ->where('initiated_at', '>=', now()->subDays(2))
            ->where('initiated_at', '<=', now()->subSeconds(15))
            ->where(function ($query): void {
                $query->whereNull('matched_at')->orWhere(function ($query): void {
                    $query->whereNotNull('recording_id')->whereNull('recording_path');
                });
            })
            ->oldest('initiated_at')
            ->get();

        if ($calls->isEmpty()) {
            return ['matched' => 0, 'recordings' => 0, 'checked' => 0];
        }

        $records = collect($this->ringCentral->callLog($calls->min('initiated_at')->copy()->subMinutes(10)))
            ->filter(fn (array $record): bool => strcasecmp((string) ($record['direction'] ?? ''), 'Outbound') === 0);
        $usedIds = RingCentralCall::query()->whereNotNull('ringcentral_call_log_id')->pluck('ringcentral_call_log_id')->all();
        $matched = 0;
        $recordings = 0;

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

            if ($call->recording_id && ! $call->recording_path) {
                $audio = $this->ringCentral->recording($call->recording_id);
                $extension = str_contains(strtolower($audio['content_type']), 'wav') ? 'wav' : 'mp3';
                $path = 'ringcentral-recordings/'.$startedAt->format('Y/m').'/'.$call->id.'.'.$extension;
                Storage::disk('local')->put($path, $audio['body']);
                $call->update([
                    'recording_path' => $path,
                    'recording_content_type' => $audio['content_type'],
                    'recorded_at' => now()->utc(),
                ]);
                $recordings++;
            }
        }

        return ['matched' => $matched, 'recordings' => $recordings, 'checked' => $calls->count()];
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
