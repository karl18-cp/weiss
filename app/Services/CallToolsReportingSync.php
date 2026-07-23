<?php

namespace App\Services;

use App\Models\Agent;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class CallToolsReportingSync
{
    private const PAGE_SIZE = 250;

    public function sync(int $maxPages = 20): array
    {
        $this->assertConfigured();
        $result = [
            'disposition_definitions' => $this->syncDispositionDefinitions(),
            'calls' => $this->syncPaged('calls', $maxPages),
            'dispositions' => $this->syncPaged('dispositions', $maxPages),
            'login_shifts' => $this->syncLoginShifts($maxPages),
            'agents' => $this->syncAgents(),
            'statuses' => $this->syncStatuses(),
        ];
        $this->state('last_success_at', now()->utc()->toIso8601String());
        $this->state('last_error', null);

        return $result;
    }

    private function syncPaged(string $type, int $maxPages): array
    {
        $backfillKey = "{$type}_backfill_page";
        $completeKey = "{$type}_backfill_complete";
        $complete = $this->stateValue($completeKey) === '1';
        $page = $complete ? 1 : max(1, (int) ($this->stateValue($backfillKey) ?: 1));
        $start = CarbonImmutable::parse(config('services.calltools.sync_start_date'), 'UTC')->startOfDay();
        $cutoff = $complete
            ? CarbonImmutable::parse($this->stateValue("{$type}_latest_at") ?: $start)->subHour()->max($start)
            : $start;
        $processed = 0;
        $stopped = false;
        $latest = null;

        for ($iteration = 0; $iteration < $maxPages; $iteration++, $page++) {
            $json = $this->get($type === 'calls' ? '/api/calls/' : '/api/historicalcalldispositions/', [
                'page' => $page,
                'page_size' => self::PAGE_SIZE,
                'ordering' => '-pk',
            ]);
            $rows = collect($json['results'] ?? []);
            if ($rows->isEmpty()) {
                $stopped = true;
                break;
            }

            $dateField = $type === 'calls' ? 'start' : 'created_on';
            $eligible = $rows->filter(function (array $row) use ($dateField, $cutoff, &$stopped, &$latest): bool {
                $date = $this->date($row[$dateField] ?? null);
                if ($date && (! $latest || $date->greaterThan($latest))) $latest = $date;
                if ($date && $date->lessThan($cutoff)) {
                    $stopped = true;
                    return false;
                }

                return $date !== null;
            });

            if ($type === 'calls') $this->upsertCalls($eligible->all());
            else $this->upsertDispositions($eligible->all());
            $processed += $eligible->count();

            if ($stopped || empty($json['next'])) break;
        }

        if (! $complete) {
            if ($stopped) {
                $this->state($completeKey, '1');
                $this->state($backfillKey, null);
            } else {
                $this->state($backfillKey, (string) $page);
            }
        }
        if ($latest) $this->state("{$type}_latest_at", $latest->toIso8601String());

        return ['processed' => $processed, 'backfill_complete' => $complete || $stopped, 'next_page' => $stopped ? null : $page];
    }

    public function syncLoginShifts(int $maxPages = 2): array
    {
        $this->assertConfigured();
        $result = $this->syncLoginShiftPages($maxPages);
        $result['live_statuses'] = $this->syncStatuses();
        $this->state('login_shifts_last_success_at', now()->utc()->toIso8601String());

        return $result;
    }

    private function syncLoginShiftPages(int $maxPages): array
    {
        $backfillKey = 'login_shifts_backfill_page';
        $completeKey = 'login_shifts_backfill_complete';
        $complete = $this->stateValue($completeKey) === '1';
        $page = $complete ? 1 : max(1, (int) ($this->stateValue($backfillKey) ?: 1));
        $start = CarbonImmutable::parse(config('services.calltools.sync_start_date'), 'UTC')->startOfDay();
        $cutoff = $complete
            ? CarbonImmutable::parse($this->stateValue('login_shifts_latest_at') ?: $start)->subDay()->max($start)
            : $start;
        $processed = 0;
        $stopped = false;
        $latest = null;

        for ($iteration = 0; $iteration < $maxPages; $iteration++, $page++) {
            $json = $this->get('/api/userloginshifts/', [
                'page' => $page,
                'page_size' => self::PAGE_SIZE,
                'ordering' => '-pk',
            ]);
            $rows = collect($json['results'] ?? []);
            if ($rows->isEmpty()) {
                $stopped = true;
                break;
            }

            $eligible = $rows->filter(function (array $row) use ($cutoff, &$stopped, &$latest): bool {
                $date = $this->date($row['start'] ?? $row['created_on'] ?? null);
                if ($date && (! $latest || $date->greaterThan($latest))) $latest = $date;
                if ($date && $date->lessThan($cutoff)) {
                    $stopped = true;
                    return false;
                }

                return $date !== null;
            });

            $this->upsertLoginShifts($eligible->all());
            $processed += $eligible->count();

            if ($stopped || empty($json['next'])) break;
        }

        if (! $complete) {
            if ($stopped) {
                $this->state($completeKey, '1');
                $this->state($backfillKey, null);
            } else {
                $this->state($backfillKey, (string) $page);
            }
        }
        if ($latest) $this->state('login_shifts_latest_at', $latest->toIso8601String());

        return ['processed' => $processed, 'backfill_complete' => $complete || $stopped, 'next_page' => $stopped ? null : $page];
    }

    private function upsertCalls(array $rows): void
    {
        $now = now();
        $data = collect($rows)->map(fn (array $row): array => [
            'calltools_id' => $this->id($row['id'] ?? null),
            'uuid' => (string) ($row['uuid'] ?? ''),
            'contact_id' => $this->externalId($row['contact'] ?? null),
            'app_user_id' => $this->externalId($row['app_user'] ?? null),
            'campaign_id' => $this->externalId($row['campaign'] ?? null),
            'system_disposition' => $this->text($row['system_disposition'] ?? null),
            'call_disposition' => $this->externalId($row['call_disposition'] ?? null),
            'destination' => $this->text($row['destination'] ?? null),
            'source' => $this->text($row['source'] ?? null),
            'inbound' => (bool) ($row['inbound'] ?? false),
            'started_at' => $this->date($row['start'] ?? null)?->format('Y-m-d H:i:s'),
            'ended_at' => $this->date($row['end'] ?? null)?->format('Y-m-d H:i:s'),
            'call_type' => $this->text($row['call_type'] ?? null),
            'duration' => max(0, (int) ($row['duration'] ?? 0)),
            'billable_seconds' => max(0, (int) ($row['billsec'] ?? 0)),
            'transferred_to' => $this->text($row['transferred_to'] ?? null),
            'recording_id' => $this->id($row['call_recording_fsfile_id'] ?? null),
            'calltools_created_at' => $this->date($row['created_on'] ?? null)?->format('Y-m-d H:i:s'),
            'created_at' => $now,
            'updated_at' => $now,
        ])->filter(fn (array $row) => $row['calltools_id'] && $row['uuid'] !== '')->values()->all();
        if ($data !== []) DB::table('calltools_calls')->upsert($data, ['calltools_id'], array_diff(array_keys($data[0]), ['calltools_id', 'created_at']));
    }

    private function upsertDispositions(array $rows): void
    {
        $now = now();
        $data = collect($rows)->map(fn (array $row): array => [
            'calltools_id' => $this->id($row['id'] ?? null),
            'call_uuid' => $this->text($row['call_uuid'] ?? null),
            'contact_id' => $this->externalId($row['contact'] ?? null),
            'app_user_id' => $this->externalId($row['app_user'] ?? null),
            'campaign_id' => $this->externalId($row['campaign'] ?? null),
            'disposition_id' => $this->externalId($row['disposition'] ?? null),
            'phone_number' => $this->text($row['phone_number'] ?? null),
            'calltools_created_at' => $this->date($row['created_on'] ?? null)?->format('Y-m-d H:i:s'),
            'created_at' => $now,
            'updated_at' => $now,
        ])->filter(fn (array $row) => $row['calltools_id'])->values()->all();
        if ($data !== []) DB::table('calltools_dispositions')->upsert($data, ['calltools_id'], array_diff(array_keys($data[0]), ['calltools_id', 'created_at']));
    }

    private function upsertLoginShifts(array $rows): void
    {
        $now = now();
        $data = collect($rows)->map(fn (array $row): array => [
            'calltools_id' => $this->externalId($row['id'] ?? null),
            'app_user_id' => $this->externalId($row['app_user'] ?? null),
            'started_at' => $this->date($row['start'] ?? null)?->format('Y-m-d H:i:s'),
            'stopped_at' => $this->date($row['stop'] ?? null)?->format('Y-m-d H:i:s'),
            'duration_seconds' => max(0, (int) ($row['duration'] ?? 0)),
            'calltools_created_at' => $this->date($row['created_on'] ?? null)?->format('Y-m-d H:i:s'),
            'created_at' => $now,
            'updated_at' => $now,
        ])->filter(fn (array $row) => $row['calltools_id'] && $row['app_user_id'] && $row['started_at'])->values()->all();

        if ($data !== []) DB::table('calltools_user_login_shifts')->upsert(
            $data,
            ['calltools_id'],
            ['app_user_id', 'started_at', 'stopped_at', 'duration_seconds', 'calltools_created_at', 'updated_at'],
        );
    }

    private function syncAgents(): int
    {
        $json = $this->get('/api/users/', ['is_agent' => 'true', 'page_size' => 'max']);
        $matched = 0;
        foreach ($this->results($json) as $row) {
            $id = $this->externalId($row['app_user'] ?? null);
            $name = trim((string) ($row['full_name'] ?? ''));
            if (! $id || $name === '') continue;
            $matches = Agent::query()->get()->filter(fn (Agent $agent): bool => $this->namesMatch($agent->agent_name, $name));
            if ($matches->count() === 1) {
                $matches->first()->update(['calltools_user_id' => $id]);
                $matched++;
            }
        }

        return $matched;
    }

    private function syncDispositionDefinitions(): int
    {
        $json = $this->get('/api/calldispositions/', ['page_size' => 'max']);
        $now = now();
        $rows = collect($this->results($json))->map(fn (array $row): array => [
            'external_id' => $this->externalId($row['id'] ?? $row['uuid'] ?? null),
            'name' => $this->text($row['name'] ?? null) ?? 'Unknown',
            'button_color' => $this->text($row['button_color'] ?? null),
            'text_color' => $this->text($row['text_color'] ?? null),
            'hang_up_call' => (bool) ($row['hang_up_call'] ?? false),
            'no_contact' => (bool) ($row['no_contact'] ?? false),
            'updated_at' => $now,
            'created_at' => $now,
        ])->filter(fn (array $row) => $row['external_id'])->values()->all();
        if ($rows !== []) DB::table('calltools_disposition_definitions')->upsert($rows, ['external_id'], ['name', 'button_color', 'text_color', 'hang_up_call', 'no_contact', 'updated_at']);

        return count($rows);
    }

    private function syncStatuses(): int
    {
        $json = $this->get('/api/agentstatuses/', ['page_size' => 'max']);
        $now = now()->utc();
        $rows = collect($this->results($json))->map(fn (array $row): array => [
            'app_user_id' => $this->externalId($row['app_user'] ?? null),
            'metric_date' => $now->toDateString(),
            'full_name' => $this->text($row['full_name'] ?? null),
            'status' => $this->text($row['agent_status'] ?? null),
            'ready' => (bool) ($row['ready'] ?? false),
            'logged_in' => (bool) ($row['logged_in'] ?? false),
            'active_seconds' => $this->seconds($row['active_time'] ?? 0),
            'available_seconds' => $this->seconds($row['campaign_available_time'] ?? 0),
            'calls' => max(0, (int) ($row['calls'] ?? 0)),
            'calls_outbound' => max(0, (int) ($row['calls_outbound'] ?? 0)),
            'calls_outbound_connected' => max(0, (int) ($row['calls_outbound_connected'] ?? 0)),
            'calls_inbound' => max(0, (int) ($row['calls_inbound'] ?? 0)),
            'transfers' => max(0, (int) ($row['transfers'] ?? 0)),
            'average_post_call_seconds' => $this->seconds($row['avg_post_call_time'] ?? 0),
            'logged_in_since' => $this->date($row['logged_in_since'] ?? null)?->format('Y-m-d H:i:s'),
            'status_modified_at' => $this->date($row['agent_status_modified_on'] ?? null)?->format('Y-m-d H:i:s'),
            'captured_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ])->filter(fn (array $row) => $row['app_user_id'])->values()->all();
        if ($rows !== []) DB::table('calltools_agent_daily_metrics')->upsert($rows, ['app_user_id', 'metric_date'], array_diff(array_keys($rows[0]), ['app_user_id', 'metric_date', 'created_at']));

        return count($rows);
    }

    private function get(string $path, array $query): array
    {
        $response = $this->request()->get(rtrim(config('services.calltools.api_base_url'), '/').$path, $query);
        if (! $response->successful()) throw new RuntimeException("CallTools {$path} returned HTTP {$response->status()}.");

        return $response->json() ?: [];
    }

    private function request(): PendingRequest
    {
        return Http::withHeaders(['Authorization' => 'Token '.config('services.calltools.api_key'), 'Accept' => 'application/json'])->timeout(30)->retry(2, 500);
    }

    private function assertConfigured(): void
    {
        if (! config('services.calltools.api_base_url') || ! config('services.calltools.api_key')) throw new RuntimeException('CallTools API configuration is missing.');
    }

    private function state(string $key, ?string $value): void
    {
        DB::table('calltools_sync_states')->updateOrInsert(['key' => $key], ['value' => $value, 'created_at' => now(), 'updated_at' => now()]);
    }

    private function stateValue(string $key): ?string
    {
        return DB::table('calltools_sync_states')->where('key', $key)->value('value');
    }

    private function id(mixed $value): ?int
    {
        $value = is_array($value) ? Arr::first(Arr::only($value, ['id', 'app_user', 'pk'])) : $value;
        if (is_string($value) && preg_match('~/(\d+)/?$~', $value, $match)) return (int) $match[1];
        return is_numeric($value) ? (int) $value : null;
    }

    private function externalId(mixed $value): ?string
    {
        if (is_array($value)) $value = Arr::first(Arr::only($value, ['id', 'app_user', 'pk', 'uuid']));
        if (! is_scalar($value) || trim((string) $value) === '') return null;
        $value = trim((string) $value);
        if (str_contains($value, '/')) $value = basename(rtrim($value, '/'));

        return mb_substr($value, 0, 191);
    }

    private function results(array $json): array
    {
        return isset($json['results']) && is_array($json['results'])
            ? $json['results']
            : (array_is_list($json) ? $json : []);
    }

    private function namesMatch(string $local, string $remote): bool
    {
        $tokens = fn (string $name): array => preg_split('/\s+/', mb_strtolower(trim(preg_replace('/[^\pL\pN\s]/u', '', $name)))) ?: [];
        $left = $tokens($local);
        $right = $tokens($remote);
        if (implode(' ', $left) === implode(' ', $right)) return true;
        if (count($left) < 2 || count($right) < 2 || $left[0] !== $right[0]) return false;

        return mb_substr(end($left), 0, 1) === mb_substr(end($right), 0, 1);
    }

    private function text(mixed $value): ?string
    {
        if (is_array($value)) $value = $value['name'] ?? $value['label'] ?? $value['id'] ?? null;
        return is_scalar($value) && trim((string) $value) !== '' ? trim((string) $value) : null;
    }

    private function date(mixed $value): ?CarbonImmutable
    {
        if (! is_scalar($value) || trim((string) $value) === '') return null;
        try { return CarbonImmutable::parse((string) $value)->utc(); } catch (\Throwable) { return null; }
    }

    private function seconds(mixed $value): int
    {
        if (is_numeric($value)) return max(0, (int) $value);
        if (is_string($value) && preg_match('/^(\d+):(\d{2}):(\d{2})$/', $value, $match)) return ((int) $match[1] * 3600) + ((int) $match[2] * 60) + (int) $match[3];
        return 0;
    }
}
