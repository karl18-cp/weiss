<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use App\Models\Lead;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class DataTeleHoursController extends Controller
{
    private const LUNCH_STATUS_ID = '43069';

    public function index(Request $request): Response
    {
        $timezone = $this->timezone($request->string('timezone')->toString());
        $selectedDate = $this->date($request->string('date')->toString(), $timezone);
        $from = $selectedDate->startOfDay()->utc();
        $to = $selectedDate->endOfDay()->utc();
        $agents = Agent::query()
            ->orderBy('agent_name')
            ->get(['agent_id', 'agent_name', 'calltools_user_id']);
        $agentsByCallToolsId = $agents->whereNotNull('calltools_user_id')
            ->keyBy(fn (Agent $agent): string => (string) $agent->calltools_user_id);
        $lunchSeconds = $this->lunchSeconds($agentsByCallToolsId->keys(), $from, $to);

        $imported = collect();
        if (Schema::hasTable('calltools_user_login_shifts')) {
            $imported = DB::table('calltools_user_login_shifts')
                ->whereIn('app_user_id', $agentsByCallToolsId->keys())
                ->whereBetween('started_at', [$from, $to])
                ->orderByDesc('started_at')
                ->get(['app_user_id', 'started_at', 'stopped_at', 'duration_seconds'])
                ->groupBy(fn (object $shift): string => $shift->app_user_id.'|'.
                    CarbonImmutable::parse($shift->started_at, 'UTC')->setTimezone($timezone)->toDateString())
                ->map(function (Collection $sessions) use ($agentsByCallToolsId, $timezone): array {
                    $first = $sessions->sortBy('started_at')->first();
                    $agent = $agentsByCallToolsId->get((string) $first->app_user_id);
                    $hasOpenSession = $sessions->contains(fn (object $session): bool => $session->stopped_at === null);

                    return [
                        'app_user_id' => (string) $first->app_user_id,
                        'agent_id' => $agent?->agent_id,
                        'agent_name' => $agent?->agent_name ?? 'Unknown agent',
                        'work_date' => CarbonImmutable::parse($first->started_at, 'UTC')->setTimezone($timezone)->toDateString(),
                        'first_login_at' => $sessions->min('started_at'),
                        'last_logout_at' => $hasOpenSession ? null : $sessions->whereNotNull('stopped_at')->max('stopped_at'),
                        'imported_seconds' => (int) $sessions->sum('duration_seconds'),
                        'sessions' => $sessions->count(),
                    ];
                });
        }

        $manual = Schema::hasTable('agent_manual_hours')
            ? DB::table('agent_manual_hours as hours')
                ->join('agents as agent', 'agent.agent_id', '=', 'hours.agent_id')
                ->whereDate('hours.work_date', $selectedDate->toDateString())
                ->get([
                    'hours.agent_id', 'agent.agent_name', 'hours.work_date',
                    'hours.first_login', 'hours.first_logout', 'hours.second_login', 'hours.second_logout',
                    'hours.duration_seconds', 'hours.lunch_seconds', 'hours.note',
                ])
                ->keyBy(fn (object $row): string => $row->agent_id.'|'.$row->work_date)
            : collect();
        $leadCounts = Lead::query()
            ->whereBetween('created_at', [$from, $to])
            ->whereNotNull('agent_id')
            ->selectRaw('agent_id, count(*) as total')
            ->groupBy('agent_id')
            ->pluck('total', 'agent_id');

        $keys = $imported->keys()->merge($manual->keys())->unique();
        $rows = $keys->map(function (string $key) use ($imported, $manual, $leadCounts, $lunchSeconds): array {
            $automatic = $imported->get($key);
            $adjustment = $manual->get($key);
            $importedSeconds = (int) ($automatic['imported_seconds'] ?? 0);
            $manualSeconds = (int) ($adjustment->duration_seconds ?? 0);
            $appUserId = (string) ($automatic['app_user_id'] ?? '');
            $hasManualEntry = $adjustment !== null;
            $deductedLunchSeconds = $hasManualEntry
                ? (int) ($adjustment->lunch_seconds ?? 0)
                : (int) ($lunchSeconds[$appUserId] ?? 0);

            return [
                'agent_id' => (int) ($automatic['agent_id'] ?? $adjustment->agent_id),
                'agent_name' => $automatic['agent_name'] ?? $adjustment->agent_name,
                'work_date' => $automatic['work_date'] ?? $adjustment->work_date,
                'first_login_at' => $automatic['first_login_at'] ?? null,
                'last_logout_at' => $automatic['last_logout_at'] ?? null,
                'imported_seconds' => $importedSeconds,
                'manual_seconds' => $manualSeconds,
                'lunch_seconds' => $deductedLunchSeconds,
                'total_seconds' => $hasManualEntry
                    ? max(0, $manualSeconds - $deductedLunchSeconds)
                    : max(0, $importedSeconds - $deductedLunchSeconds),
                'manual_override' => $hasManualEntry,
                'sessions' => (int) ($automatic['sessions'] ?? 0),
                'manual_first_login' => $adjustment->first_login ?? null,
                'manual_first_logout' => $adjustment->first_logout ?? null,
                'manual_second_login' => $adjustment->second_login ?? null,
                'manual_second_logout' => $adjustment->second_logout ?? null,
                'leads_sent' => (int) ($leadCounts[$automatic['agent_id'] ?? $adjustment->agent_id] ?? 0),
                'note' => $adjustment->note ?? null,
            ];
        })->sortBy([
            ['work_date', 'desc'],
            ['agent_name', 'asc'],
        ])->values();

        return Inertia::render('lead-workflow/data-tele-hours', [
            'hours' => $rows,
            'agents' => $agents->map(fn (Agent $agent): array => [
                'id' => $agent->agent_id,
                'name' => $agent->agent_name,
            ]),
            'timezone' => $timezone,
            'selectedDate' => $selectedDate->toDateString(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'agent_ids' => ['required', 'array', 'min:1'],
            'agent_ids.*' => ['required', 'integer', 'distinct', Rule::exists('agents', 'agent_id')],
            'work_date' => ['required', 'date'],
            'first_login' => ['required', 'date_format:H:i'],
            'first_logout' => ['required', 'date_format:H:i', 'after:first_login'],
            'lunch_hours' => ['required', 'numeric', 'min:0', 'max:24'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        DB::transaction(function () use ($validated): void {
            $durationSeconds = CarbonImmutable::createFromFormat('H:i', $validated['first_login'])
                ->diffInSeconds(CarbonImmutable::createFromFormat('H:i', $validated['first_logout']));
            $lunchSeconds = (int) round(((float) $validated['lunch_hours']) * 3600);
            if ($lunchSeconds > $durationSeconds) {
                throw ValidationException::withMessages([
                    'lunch_hours' => 'Lunch cannot be longer than the manual login duration.',
                ]);
            }
            foreach ($validated['agent_ids'] as $agentId) {
                DB::table('agent_manual_hours')->updateOrInsert(
                    ['agent_id' => $agentId, 'work_date' => $validated['work_date']],
                    [
                        'first_login' => $validated['first_login'],
                        'first_logout' => $validated['first_logout'],
                        'second_login' => null,
                        'second_logout' => null,
                        'duration_seconds' => $durationSeconds,
                        'lunch_seconds' => $lunchSeconds,
                        'note' => $validated['note'] ?: null,
                        'created_by' => auth()->id(),
                        'updated_at' => now(),
                        'created_at' => now(),
                    ],
                );
            }
        });

        return back()->with('success', count($validated['agent_ids']).' agent hour records saved.');
    }

    private function timezone(string $requested): string
    {
        return $requested !== '' && in_array($requested, timezone_identifiers_list(), true)
            ? $requested
            : (string) config('services.calltools.report_timezone', 'Asia/Manila');
    }

    private function date(string $requested, string $timezone): CarbonImmutable
    {
        try {
            return $requested !== ''
                ? CarbonImmutable::parse($requested, $timezone)->startOfDay()
                : CarbonImmutable::today($timezone);
        } catch (\Throwable) {
            return CarbonImmutable::today($timezone);
        }
    }

    private function lunchSeconds(mixed $appUserIds, CarbonImmutable $from, CarbonImmutable $to): mixed
    {
        if (! Schema::hasTable('calltools_agent_status_intervals')) {
            return collect();
        }

        return DB::table('calltools_agent_status_intervals')
            ->where('status_id', self::LUNCH_STATUS_ID)
            ->whereIn('app_user_id', $appUserIds)
            ->where('started_at', '<=', $to)
            ->where(fn ($query) => $query->whereNull('ended_at')->orWhere('ended_at', '>=', $from))
            ->get(['app_user_id', 'started_at', 'ended_at'])
            ->groupBy('app_user_id')
            ->map(fn ($rows): int => (int) $rows->sum(function ($row) use ($from, $to): int {
                $start = CarbonImmutable::parse($row->started_at, 'UTC')->max($from);
                $end = ($row->ended_at ? CarbonImmutable::parse($row->ended_at, 'UTC') : now('UTC'))->min($to);

                return $end->greaterThan($start) ? $start->diffInSeconds($end) : 0;
            }));
    }
}
