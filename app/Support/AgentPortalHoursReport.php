<?php

namespace App\Support;

use App\Models\Agent;
use App\Models\AgentAttendanceSession;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AgentPortalHoursReport
{
    public function __construct(private readonly AgentAttendanceHours $attendanceHours) {}

    /**
     * Build the single source of truth used by both Tele Report screens.
     * Agent Portal attendance is authoritative for every day where it exists.
     * Older days without portal attendance fall back to CallTools login shifts,
     * and manual hour records override either automatic source.
     */
    public function rows(
        Collection $agents,
        CarbonImmutable $from,
        CarbonImmutable $to,
        Collection $leadCounts,
        string $timezone,
        bool $includeEmpty = false,
    ): Collection {
        $agentIds = $agents->pluck('agent_id');
        $isRange = ! $from->isSameDay($to);
        $now = CarbonImmutable::now($timezone);

        $excluded = Schema::hasTable('agent_hour_exclusions')
            ? DB::table('agent_hour_exclusions')
                ->whereIn('agent_id', $agentIds)
                ->whereBetween('work_date', [$from->toDateString(), $to->toDateString()])
                ->get(['agent_id', 'work_date'])
                ->mapWithKeys(fn (object $row): array => [$row->agent_id.'|'.$row->work_date => true])
            : collect();

        $days = collect();
        if (Schema::hasTable('agent_attendance_sessions')) {
            AgentAttendanceSession::query()
                ->whereIn('agent_id', $agentIds)
                ->whereBetween('work_date', [$from->toDateString(), $to->toDateString()])
                ->get()
                ->groupBy(fn (AgentAttendanceSession $session): string => $session->agent_id.'|'.$session->work_date->toDateString())
                ->each(function (Collection $sessions, string $key) use ($days, $excluded, $now): void {
                    if ($excluded->has($key)) {
                        return;
                    }

                    /** @var AgentAttendanceSession $first */
                    $first = $sessions->sortBy('clocked_in_at')->first();
                    $hasOpen = $sessions->contains(fn (AgentAttendanceSession $session): bool => $session->clocked_out_at === null);
                    $days->put($key, [
                        'agent_id' => $first->agent_id,
                        'work_date' => $first->work_date->toDateString(),
                        'first_login_at' => $sessions->min('clocked_in_at')?->toIso8601String(),
                        'last_logout_at' => $hasOpen ? null : $sessions->max('clocked_out_at')?->toIso8601String(),
                        'logged_seconds' => (int) $sessions->sum(fn (AgentAttendanceSession $session): int => $this->attendanceHours->grossSeconds($session, $now)),
                        'lunch_seconds' => $this->attendanceHours->reportedLunchSeconds($sessions, $now),
                        'sessions' => $sessions->count(),
                        'manual_override' => false,
                        'note' => null,
                        'manual_first_login' => null,
                        'manual_first_logout' => null,
                        'attendance_source' => 'Agent portal',
                    ]);
                });
        }

        if (Schema::hasTable('calltools_user_login_shifts')) {
            $agentsByCallToolsId = $agents
                ->whereNotNull('calltools_user_id')
                ->keyBy(fn (Agent $agent): string => (string) $agent->calltools_user_id);
            $callToolsIds = $agentsByCallToolsId->keys();
            $utcFrom = $from->startOfDay()->utc();
            $utcTo = $to->endOfDay()->utc();
            $lunchByUser = Schema::hasTable('calltools_agent_status_intervals')
                ? DB::table('calltools_agent_status_intervals')
                    ->where('status_id', '43069')
                    ->whereIn('app_user_id', $callToolsIds)
                    ->where('started_at', '<=', $utcTo)
                    ->where(fn ($query) => $query->whereNull('ended_at')->orWhere('ended_at', '>=', $utcFrom))
                    ->get(['app_user_id', 'started_at', 'ended_at'])
                    ->groupBy(fn (object $row): string => (string) $row->app_user_id)
                : collect();

            DB::table('calltools_user_login_shifts')
                ->whereIn('app_user_id', $callToolsIds)
                ->whereBetween('started_at', [$utcFrom, $utcTo])
                ->get(['app_user_id', 'started_at', 'stopped_at', 'duration_seconds'])
                ->groupBy(function (object $shift) use ($agentsByCallToolsId, $timezone): string {
                    $agent = $agentsByCallToolsId->get((string) $shift->app_user_id);
                    $workDate = CarbonImmutable::parse($shift->started_at, 'UTC')
                        ->setTimezone($timezone)
                        ->toDateString();

                    return $agent->agent_id.'|'.$workDate;
                })
                ->each(function (Collection $shifts, string $key) use ($agentsByCallToolsId, $days, $excluded, $lunchByUser, $now, $timezone): void {
                    // Portal attendance (or an explicit exclusion) always wins
                    // for this exact agent and California business date.
                    if ($days->has($key) || $excluded->has($key)) {
                        return;
                    }

                    $ordered = $shifts->sortBy('started_at')->values();
                    $first = $ordered->first();
                    $agent = $agentsByCallToolsId->get((string) $first->app_user_id);
                    $workDate = explode('|', $key, 2)[1];
                    $dayStart = CarbonImmutable::parse($workDate, $timezone)->startOfDay()->utc();
                    $dayEnd = CarbonImmutable::parse($workDate, $timezone)->endOfDay()->utc();
                    $hasOpen = $shifts->contains(fn (object $shift): bool => $shift->stopped_at === null);
                    $loggedSeconds = $shifts->sum(function (object $shift) use ($now, $dayStart, $dayEnd): int {
                        $start = CarbonImmutable::parse($shift->started_at, 'UTC')->max($dayStart);
                        $end = ($shift->stopped_at
                            ? CarbonImmutable::parse($shift->stopped_at, 'UTC')
                            : $now->utc())->min($dayEnd);

                        return $end->greaterThan($start)
                            ? $start->diffInSeconds($end)
                            : max(0, (int) ($shift->duration_seconds ?? 0));
                    });
                    $lunchSeconds = collect($lunchByUser->get((string) $first->app_user_id, []))
                        ->sum(function (object $interval) use ($now, $dayStart, $dayEnd): int {
                            $start = CarbonImmutable::parse($interval->started_at, 'UTC')->max($dayStart);
                            $end = ($interval->ended_at
                                ? CarbonImmutable::parse($interval->ended_at, 'UTC')
                                : $now->utc())->min($dayEnd);

                            return $end->greaterThan($start) ? $start->diffInSeconds($end) : 0;
                        });

                    $days->put($key, [
                        'agent_id' => $agent->agent_id,
                        'work_date' => $workDate,
                        'first_login_at' => $shifts->min('started_at'),
                        'last_logout_at' => $hasOpen ? null : $shifts->whereNotNull('stopped_at')->max('stopped_at'),
                        'logged_seconds' => (int) $loggedSeconds,
                        'lunch_seconds' => (int) $lunchSeconds,
                        'sessions' => $shifts->count(),
                        'manual_override' => false,
                        'note' => null,
                        'manual_first_login' => null,
                        'manual_first_logout' => null,
                        'attendance_source' => 'CallTools',
                    ]);
                });
        }

        if (Schema::hasTable('agent_manual_hours')) {
            DB::table('agent_manual_hours')
                ->whereIn('agent_id', $agentIds)
                ->whereBetween('work_date', [$from->toDateString(), $to->toDateString()])
                ->get()
                ->each(function (object $manual) use ($days, $timezone): void {
                    $workDate = CarbonImmutable::parse($manual->work_date)->toDateString();
                    $key = $manual->agent_id.'|'.$workDate;
                    $automatic = $days->get($key);
                    $firstLogin = $this->timeToIso($workDate, $manual->first_login, $timezone);
                    $lastLogout = $this->timeToIso($workDate, $manual->first_logout, $timezone);
                    $days->put($key, [
                        'agent_id' => (int) $manual->agent_id,
                        'work_date' => $workDate,
                        'first_login_at' => $firstLogin,
                        'last_logout_at' => $lastLogout,
                        'logged_seconds' => (int) $manual->duration_seconds,
                        'lunch_seconds' => max(
                            AgentAttendanceHours::STANDARD_LUNCH_SECONDS,
                            (int) ($manual->lunch_seconds ?? 0),
                        ),
                        'sessions' => (int) ($automatic['sessions'] ?? 1),
                        'manual_override' => true,
                        'note' => $manual->note,
                        'manual_first_login' => $manual->first_login,
                        'manual_first_logout' => $manual->first_logout,
                        'leads_sent_override' => $manual->leads_sent_override,
                        'attendance_source' => 'Manual correction',
                    ]);
                });
        }

        $agentsById = $agents->keyBy('agent_id');
        $rows = $days->values()->groupBy('agent_id')->map(function (Collection $agentDays, int|string $agentId) use ($agentsById, $leadCounts, $from, $to, $isRange): object {
            /** @var Agent|null $agent */
            $agent = $agentsById->get((int) $agentId);
            $ordered = $agentDays->sortBy('work_date')->values();
            $first = $ordered->first();
            $hasOpen = $agentDays->contains(fn (array $day): bool => $day['first_login_at'] !== null && $day['last_logout_at'] === null);

            return (object) [
                'app_user_id' => $agent?->calltools_user_id ?: 'agent-'.$agentId,
                'agent_id' => (int) $agentId,
                'agent_name' => $agent?->agent_name ?? 'Unknown agent',
                'shift_date' => $isRange ? $from->toDateString().' - '.$to->toDateString() : $first['work_date'],
                'first_login_at' => $agentDays->pluck('first_login_at')->filter()->min(),
                'last_logout_at' => $hasOpen ? null : $agentDays->pluck('last_logout_at')->filter()->max(),
                'logged_seconds' => (int) $agentDays->sum('logged_seconds'),
                'lunch_seconds' => (int) $agentDays->sum('lunch_seconds'),
                'sessions' => (int) $agentDays->sum('sessions'),
                'leads_sent' => (int) ($agentDays->pluck('leads_sent_override')->filter(fn ($value) => $value !== null)->last() ?? $leadCounts[(int) $agentId] ?? 0),
                'manual_override' => $agentDays->contains('manual_override', true),
                'manual_first_login' => $isRange ? null : $first['manual_first_login'],
                'manual_first_logout' => $isRange ? null : $first['manual_first_logout'],
                'note' => $isRange ? null : $first['note'],
                'attendance_source' => $agentDays->pluck('attendance_source')->unique()->sort()->implode(' + '),
            ];
        });

        if ($includeEmpty) {
            foreach ($agents as $agent) {
                if ($rows->has($agent->agent_id)) {
                    continue;
                }
                $rows->put($agent->agent_id, (object) [
                    'app_user_id' => $agent->calltools_user_id ?: 'agent-'.$agent->agent_id,
                    'agent_id' => $agent->agent_id,
                    'agent_name' => $agent->agent_name,
                    'shift_date' => $isRange ? $from->toDateString().' - '.$to->toDateString() : $from->toDateString(),
                    'first_login_at' => null,
                    'last_logout_at' => null,
                    'logged_seconds' => 0,
                    'lunch_seconds' => 0,
                    'sessions' => 0,
                    'leads_sent' => (int) ($leadCounts[$agent->agent_id] ?? 0),
                    'manual_override' => false,
                    'manual_first_login' => null,
                    'manual_first_logout' => null,
                    'note' => null,
                    'attendance_source' => 'No attendance',
                ]);
            }
        }

        return $rows->sortBy('agent_name')->values();
    }

    private function timeToIso(string $date, ?string $time, string $timezone): ?string
    {
        if (! $time) {
            return null;
        }

        return CarbonImmutable::parse($date.' '.$time, $timezone)->utc()->toIso8601String();
    }
}
