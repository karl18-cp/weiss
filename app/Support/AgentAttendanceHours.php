<?php

namespace App\Support;

use App\Models\AgentAttendanceSession;
use Carbon\CarbonInterface;

class AgentAttendanceHours
{
    public const STANDARD_LUNCH_SECONDS = 3600;

    public function grossSeconds(AgentAttendanceSession $session, CarbonInterface $now): int
    {
        $end = $session->clocked_out_at ?? $now;

        return max(0, $session->clocked_in_at->diffInSeconds($end));
    }

    public function lunchSeconds(AgentAttendanceSession $session, CarbonInterface $now): int
    {
        if (! $session->lunch_out_at) {
            return 0;
        }

        $end = $session->lunch_in_at ?? $session->clocked_out_at ?? $now;

        return max(0, $session->lunch_out_at->diffInSeconds($end));
    }

    public function netSeconds(AgentAttendanceSession $session, CarbonInterface $now): int
    {
        return max(0, $this->grossSeconds($session, $now) - $this->lunchSeconds($session, $now));
    }

    /**
     * Tele Reports deduct one standard lunch hour for every worked day. When
     * Agent Portal punches show a longer break, use the actual over-lunch
     * duration instead of the schedule-adjusted attendance timestamps.
     */
    public function reportedLunchSeconds(iterable $sessions, CarbonInterface $now): int
    {
        $hasAttendance = false;
        $actualSeconds = 0;

        foreach ($sessions as $session) {
            $hasAttendance = true;
            $start = $session->actual_lunch_out_at ?? $session->lunch_out_at;

            if (! $start) {
                continue;
            }

            $end = $session->actual_lunch_in_at
                ?? $session->actual_clocked_out_at
                ?? $session->lunch_in_at
                ?? $session->clocked_out_at
                ?? $now;

            $actualSeconds += max(0, $start->diffInSeconds($end));
        }

        return $hasAttendance
            ? max(self::STANDARD_LUNCH_SECONDS, $actualSeconds)
            : 0;
    }
}
