<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use App\Models\Lead;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

class TeleHoursController extends Controller
{
    private const LUNCH_STATUS_ID = '43069';

    public function __invoke(Request $request): Response
    {
        $timezone = $this->timezone($request->string('timezone')->toString());
        $minimum = CarbonImmutable::parse(config('services.calltools.sync_start_date'), $timezone)->startOfDay();
        $today = CarbonImmutable::today($timezone);
        $selectedFrom = $this->date($request->string('from')->toString() ?: $request->string('date')->toString(), $today, $timezone)->max($minimum);
        $selectedTo = $this->date($request->string('to')->toString(), $selectedFrom, $timezone)->max($selectedFrom)->min($today);
        $isRange = ! $selectedFrom->isSameDay($selectedTo);
        $from = $selectedFrom->startOfDay()->utc();
        $to = $selectedTo->endOfDay()->utc();
        $agentId = $request->integer('agent') ?: null;
        $leadCounts = Lead::query()
            ->whereBetween('created_at', [$from, $to])
            ->whereNotNull('agent_id')
            ->selectRaw('agent_id, count(*) as total')
            ->groupBy('agent_id')
            ->pluck('total', 'agent_id');

        $agents = Agent::query()->orderBy('agent_name')->get(['agent_id', 'agent_name', 'account_id', 'calltools_user_id']);
        $appUserIds = $agents->pluck('calltools_user_id')->filter();
        $lunchSeconds = $this->lunchSeconds($appUserIds, $from, $to);

        $loginDays = collect();
        $logs = collect();
        $dispositions = collect();
        if (Schema::hasTable('calltools_calls')) {
            $logs = DB::table('calltools_calls as call')
                ->leftJoin('agents as agent', 'agent.calltools_user_id', '=', 'call.app_user_id')
                ->leftJoin('calltools_disposition_definitions as definition', 'definition.external_id', '=', 'call.call_disposition')
                ->whereBetween('call.started_at', [$from, $to])
                ->when($agentId, fn ($query) => $query->where('agent.agent_id', $agentId))
                ->latest('call.started_at')->limit(100)
                ->get(['call.uuid', 'call.started_at', 'call.inbound', 'call.call_type', 'call.duration', 'call.billable_seconds', 'call.system_disposition', 'call.call_disposition', 'call.source', 'call.destination', 'agent.agent_name', 'definition.name as disposition_name']);

            $dispositions = DB::table('calltools_dispositions as disposition')
                ->leftJoin('agents as agent', 'agent.calltools_user_id', '=', 'disposition.app_user_id')
                ->leftJoin('calltools_disposition_definitions as definition', 'definition.external_id', '=', 'disposition.disposition_id')
                ->whereBetween('disposition.calltools_created_at', [$from, $to])
                ->when($agentId, fn ($query) => $query->where('agent.agent_id', $agentId))
                ->latest('disposition.calltools_created_at')->limit(100)
                ->get(['disposition.call_uuid', 'disposition.phone_number', 'disposition.calltools_created_at', 'agent.agent_name', 'definition.name as disposition_name']);
        }

        if (Schema::hasTable('calltools_user_login_shifts')) {
            $selectedCallToolsUserId = $agentId
                ? $agents->firstWhere('agent_id', $agentId)?->calltools_user_id
                : null;
            $shifts = DB::table('calltools_user_login_shifts as shift')
                ->whereBetween('shift.started_at', [$from, $to])
                ->whereIn('shift.app_user_id', $appUserIds)
                ->when($agentId, function ($query) use ($selectedCallToolsUserId): void {
                    if ($selectedCallToolsUserId) {
                        $query->where('shift.app_user_id', $selectedCallToolsUserId);
                    } else {
                        $query->whereRaw('1 = 0');
                    }
                })
                ->get(['shift.app_user_id', 'shift.started_at', 'shift.stopped_at', 'shift.duration_seconds']);

            $agentsByCallToolsUserId = $agents
                ->whereNotNull('calltools_user_id')
                ->keyBy(fn (Agent $agent): string => (string) $agent->calltools_user_id);

            $shifts->each(function (object $shift) use ($agentsByCallToolsUserId): void {
                $agent = $agentsByCallToolsUserId->get((string) $shift->app_user_id);
                $shift->agent_id = $agent?->agent_id;
                $shift->agent_name = $agent?->agent_name;
            });

            if ($selectedTo->isSameDay($today) && Schema::hasTable('calltools_agent_daily_metrics')) {
                $liveStatuses = DB::table('calltools_agent_daily_metrics')
                    ->where('logged_in', true)
                    ->whereBetween('logged_in_since', [$from, $to])
                    ->whereIn('app_user_id', $appUserIds)
                    ->get(['app_user_id', 'logged_in_since']);

                foreach ($liveStatuses as $status) {
                    $alreadyHasOpenShift = $shifts->contains(
                        fn (object $shift): bool =>
                            (string) $shift->app_user_id === (string) $status->app_user_id
                            && $shift->stopped_at === null,
                    );

                    if ($alreadyHasOpenShift) {
                        continue;
                    }

                    $agent = $agentsByCallToolsUserId->get((string) $status->app_user_id);
                    $startedAt = CarbonImmutable::parse($status->logged_in_since, 'UTC');
                    $shifts->push((object) [
                        'app_user_id' => (string) $status->app_user_id,
                        'agent_id' => $agent?->agent_id,
                        'agent_name' => $agent?->agent_name,
                        'started_at' => $startedAt->format('Y-m-d H:i:s'),
                        'stopped_at' => null,
                        'duration_seconds' => $startedAt->diffInSeconds(now('UTC')),
                    ]);
                }
            }

            $loginDays = $shifts
                ->groupBy(fn ($shift) => $isRange
                    ? (string) $shift->app_user_id
                    : $shift->app_user_id.'|'.CarbonImmutable::parse($shift->started_at, 'UTC')->setTimezone($timezone)->toDateString())
                ->map(function ($sessions) use ($timezone, $leadCounts, $lunchSeconds, $isRange, $selectedFrom, $selectedTo): object {
                    $ordered = $sessions->sortBy('started_at')->values();
                    $first = $ordered->first();
                    $hasOpenSession = $sessions->contains(
                        fn (object $session): bool => $session->stopped_at === null,
                    );
                    $lastLogout = $hasOpenSession
                        ? null
                        : $sessions->whereNotNull('stopped_at')->max('stopped_at');

                    return (object) [
                        'app_user_id' => $first->app_user_id,
                        'agent_id' => $first->agent_id,
                        'agent_name' => $first->agent_name,
                        'shift_date' => $isRange
                            ? $selectedFrom->toDateString().' – '.$selectedTo->toDateString()
                            : CarbonImmutable::parse($first->started_at, 'UTC')->setTimezone($timezone)->toDateString(),
                        'first_login_at' => $sessions->min('started_at'),
                        'last_logout_at' => $lastLogout,
                        'logged_seconds' => (int) $sessions->sum('duration_seconds'),
                        'lunch_seconds' => (int) ($lunchSeconds[(string) $first->app_user_id] ?? 0),
                        'sessions' => $sessions->count(),
                        'leads_sent' => (int) ($leadCounts[$first->agent_id] ?? 0),
                    ];
                })
                ->sortBy([['shift_date', 'desc'], ['agent_name', 'asc']])
                ->values();

            $loginDaysByAgent = $loginDays->keyBy('agent_id');
            $visibleAgents = $agentId
                ? $agents->where('agent_id', $agentId)
                : $agents;

            $loginDays = $visibleAgents
                ->map(function (Agent $agent) use ($loginDaysByAgent, $selectedFrom, $selectedTo, $isRange, $leadCounts, $lunchSeconds): object {
                    return $loginDaysByAgent->get($agent->agent_id) ?? (object) [
                        'app_user_id' => $agent->calltools_user_id,
                        'agent_id' => $agent->agent_id,
                        'agent_name' => $agent->agent_name,
                        'shift_date' => $isRange
                            ? $selectedFrom->toDateString().' – '.$selectedTo->toDateString()
                            : $selectedFrom->toDateString(),
                        'first_login_at' => null,
                        'last_logout_at' => null,
                        'logged_seconds' => 0,
                        'lunch_seconds' => (int) ($lunchSeconds[(string) $agent->calltools_user_id] ?? 0),
                        'sessions' => 0,
                        'leads_sent' => (int) ($leadCounts[$agent->agent_id] ?? 0),
                    ];
                })
                ->values();

        }

        return Inertia::render('lead-workflow/tele-hours', [
            'loginDays' => $loginDays,
            'agentOptions' => $agents->map(fn (Agent $agent) => ['id' => $agent->agent_id, 'name' => $agent->agent_name]),
            'callLogs' => $logs,
            'dispositions' => $dispositions,
            'filters' => [
                'from' => $selectedFrom->toDateString(),
                'to' => $selectedTo->toDateString(),
                'agent' => $agentId,
                'timezone' => $timezone,
            ],
            'isRange' => $isRange,
            'sync' => Schema::hasTable('calltools_sync_states') ? DB::table('calltools_sync_states')->pluck('value', 'key') : [],
            'activityCoverage' => Schema::hasTable('calltools_user_login_shifts')
                ? $this->loginCoverage($timezone)
                : ['from' => null, 'to' => null],
        ]);
    }

    private function date(string $value, mixed $fallback, string $timezone): CarbonImmutable
    {
        try { return $value !== '' ? CarbonImmutable::parse($value, $timezone) : CarbonImmutable::parse($fallback, $timezone); }
        catch (\Throwable) { return CarbonImmutable::parse($fallback, $timezone); }
    }

    private function loginCoverage(string $timezone): array
    {
        $first = DB::table('calltools_user_login_shifts')->min('started_at');
        $last = DB::table('calltools_user_login_shifts')->max('started_at');

        return [
            'from' => $first ? CarbonImmutable::parse($first, 'UTC')->setTimezone($timezone)->toDateString() : null,
            'to' => $last ? CarbonImmutable::parse($last, 'UTC')->setTimezone($timezone)->toDateString() : null,
        ];
    }

    private function timezone(string $requested): string
    {
        if ($requested !== '' && in_array($requested, timezone_identifiers_list(), true)) {
            return $requested;
        }

        return (string) config('services.calltools.report_timezone', 'Asia/Manila');
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
