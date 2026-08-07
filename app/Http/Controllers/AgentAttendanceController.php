<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use App\Models\AgentAttendanceSession;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class AgentAttendanceController extends Controller
{
    public function index(Request $request): Response
    {
        $agent = $this->agent($request);
        $now = now();
        $todayStart = $now->copy()->startOfDay();
        $todayEnd = $now->copy()->endOfDay();

        $openSession = $agent->attendanceSessions()
            ->whereNull('clocked_out_at')
            ->latest('clocked_in_at')
            ->first();

        $todaySeconds = $agent->attendanceSessions()
            ->whereBetween('clocked_in_at', [$todayStart, $todayEnd])
            ->get()
            ->sum(fn (AgentAttendanceSession $session): int => $session->clocked_in_at
                ->diffInSeconds($session->clocked_out_at ?? $now));

        $recentSessions = $agent->attendanceSessions()
            ->latest('clocked_in_at')
            ->limit(10)
            ->get()
            ->map(fn (AgentAttendanceSession $session): array => [
                'id' => $session->id,
                'clocked_in_at' => $session->clocked_in_at->toIso8601String(),
                'clocked_out_at' => $session->clocked_out_at?->toIso8601String(),
                'duration_seconds' => $session->clocked_in_at
                    ->diffInSeconds($session->clocked_out_at ?? $now),
            ]);

        return Inertia::render('agent/dashboard', [
            'agent' => ['id' => $agent->agent_id, 'name' => $agent->agent_name],
            'openSession' => $openSession ? [
                'id' => $openSession->id,
                'clocked_in_at' => $openSession->clocked_in_at->toIso8601String(),
            ] : null,
            'todaySeconds' => $todaySeconds,
            'recentSessions' => $recentSessions,
            'serverNow' => $now->toIso8601String(),
        ]);
    }

    public function clockIn(Request $request): RedirectResponse
    {
        $agent = $this->agent($request);

        $created = DB::transaction(function () use ($agent): bool {
            $alreadyOpen = AgentAttendanceSession::query()
                ->where('agent_id', $agent->agent_id)
                ->whereNull('clocked_out_at')
                ->lockForUpdate()
                ->exists();

            if ($alreadyOpen) {
                return false;
            }

            AgentAttendanceSession::query()->create([
                'agent_id' => $agent->agent_id,
                'clocked_in_at' => now(),
            ]);

            return true;
        });

        return back()->with(
            $created ? 'success' : 'info',
            $created ? 'You are now timed in.' : 'You are already timed in.',
        );
    }

    public function clockOut(Request $request): RedirectResponse
    {
        $agent = $this->agent($request);

        $closed = DB::transaction(function () use ($agent): bool {
            $session = AgentAttendanceSession::query()
                ->where('agent_id', $agent->agent_id)
                ->whereNull('clocked_out_at')
                ->latest('clocked_in_at')
                ->lockForUpdate()
                ->first();

            if (! $session) {
                return false;
            }

            $session->update(['clocked_out_at' => now()]);

            return true;
        });

        return back()->with(
            $closed ? 'success' : 'info',
            $closed ? 'You are now timed out.' : 'There is no open time session.',
        );
    }

    private function agent(Request $request): Agent
    {
        $user = $request->user();
        abort_unless($user?->role === 'agent', 403, 'This workspace is for agent accounts only.');

        $agent = $user->agent;
        abort_unless($agent, 403, 'Your account is not linked to an agent profile.');

        return $agent;
    }
}
