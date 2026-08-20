<?php

namespace App\Console\Commands;

use App\Models\AgentAttendanceSession;
use App\Models\AgentSchedule;
use App\Support\AgentAttendanceHours;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

class RepairAgentAttendanceHours extends Command
{
    protected $signature = 'attendance:repair-hours {--apply : Persist corrected effective timestamps}';

    protected $description = 'Audit and repair agent portal hours using the shared California schedule';

    public function handle(AgentAttendanceHours $hours): int
    {
        $apply = (bool) $this->option('apply');
        $audited = 0;
        $changed = 0;
        $beforeSeconds = 0;
        $afterSeconds = 0;

        AgentAttendanceSession::query()
            ->with('agent:agent_id,agent_name')
            ->orderBy('id')
            ->chunkById(200, function ($sessions) use ($apply, $hours, &$audited, &$changed, &$beforeSeconds, &$afterSeconds): void {
                foreach ($sessions as $session) {
                    $audited++;
                    $now = CarbonImmutable::now('America/Los_Angeles');
                    $beforeSeconds += $hours->netSeconds($session, $now);
                    $schedule = AgentSchedule::query()
                        ->where('weekday', $session->work_date->dayOfWeek)
                        ->latest('updated_at')
                        ->latest('id')
                        ->first();

                    if (! $schedule?->is_working || ! $schedule->shift_start || ! $schedule->shift_end) {
                        $afterSeconds += $hours->netSeconds($session, $now);
                        continue;
                    }

                    $date = $session->work_date->toDateString();
                    $scheduledStart = CarbonImmutable::parse($date.' '.$schedule->shift_start, 'America/Los_Angeles');
                    $scheduledEnd = CarbonImmutable::parse($date.' '.$schedule->shift_end, 'America/Los_Angeles');
                    $values = [];

                    if ($session->actual_clocked_in_at) {
                        $values['clocked_in_at'] = $session->actual_clocked_in_at->greaterThan($scheduledStart)
                            ? $session->actual_clocked_in_at
                            : $scheduledStart;
                    }

                    if ($session->clocked_out_at) {
                        $values['clocked_out_at'] = $scheduledEnd->lessThan($values['clocked_in_at'] ?? $session->clocked_in_at)
                            ? ($values['clocked_in_at'] ?? $session->clocked_in_at)
                            : $scheduledEnd;
                    }

                    if ($session->lunch_out_at && $schedule->lunch_start) {
                        $scheduledLunchOut = CarbonImmutable::parse($date.' '.$schedule->lunch_start, 'America/Los_Angeles');
                        $actualLunchOut = $session->actual_lunch_out_at ?? $session->lunch_out_at;
                        $values['lunch_out_at'] = $actualLunchOut->greaterThan($scheduledLunchOut) ? $actualLunchOut : $scheduledLunchOut;
                    }

                    if ($session->lunch_in_at && $schedule->lunch_end) {
                        $scheduledLunchIn = CarbonImmutable::parse($date.' '.$schedule->lunch_end, 'America/Los_Angeles');
                        $actualLunchIn = $session->actual_lunch_in_at ?? $session->lunch_in_at;
                        $effectiveLunchIn = $actualLunchIn->greaterThan($scheduledLunchIn) ? $actualLunchIn : $scheduledLunchIn;
                        $values['lunch_in_at'] = isset($values['clocked_out_at']) && $effectiveLunchIn->greaterThan($values['clocked_out_at'])
                            ? $values['clocked_out_at']
                            : $effectiveLunchIn;
                    }

                    $isChanged = collect($values)->contains(
                        fn ($value, $field): bool => ! $session->{$field}?->equalTo($value),
                    );

                    if ($isChanged) {
                        $changed++;
                        if ($apply) {
                            $session->update($values);
                            $session->refresh();
                        } else {
                            $session->forceFill($values);
                        }
                    }

                    $afterSeconds += $hours->netSeconds($session, $now);
                }
            });

        $this->table(['Audited', 'Changed', 'Before net hours', 'After net hours', 'Mode'], [[
            $audited,
            $changed,
            round($beforeSeconds / 3600, 2),
            round($afterSeconds / 3600, 2),
            $apply ? 'APPLIED' : 'DRY RUN',
        ]]);

        return self::SUCCESS;
    }
}
