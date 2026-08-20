<?php

namespace App\Support;

use App\Models\AgentAttendanceSession;
use Carbon\CarbonInterface;

class AgentAttendanceHours
{
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
}
