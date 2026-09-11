<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use App\Models\Lead;
use App\Support\AgentPortalHoursReport;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class DataTeleHoursController extends Controller
{
    public function index(Request $request, AgentPortalHoursReport $portalHoursReport): Response
    {
        $timezone = $this->timezone($request->string('timezone')->toString());
        $selectedDate = $this->date($request->string('date')->toString(), $timezone);
        $from = $selectedDate->startOfDay()->utc();
        $to = $selectedDate->endOfDay()->utc();
        $agents = Agent::query()
            ->orderBy('agent_name')
            ->get(['agent_id', 'agent_name', 'calltools_user_id', 'inactive_at']);
        $activeAgents = $agents->whereNull('inactive_at');
        $leadCounts = Lead::query()
            ->whereBetween('created_at', [$from, $to])
            ->whereNotNull('agent_id')
            ->selectRaw('agent_id, count(*) as total')
            ->groupBy('agent_id')
            ->pluck('total', 'agent_id');
        $rows = $portalHoursReport->rows($agents, $selectedDate, $selectedDate, $leadCounts, $timezone)
            ->map(fn (object $row): array => [
                'agent_id' => $row->agent_id,
                'agent_name' => $row->agent_name,
                'work_date' => $row->shift_date,
                'first_login_at' => $row->first_login_at,
                'last_logout_at' => $row->last_logout_at,
                'logged_seconds' => $row->logged_seconds,
                'lunch_seconds' => $row->lunch_seconds,
                'total_seconds' => max(0, $row->logged_seconds - $row->lunch_seconds),
                'manual_override' => $row->manual_override,
                'sessions' => $row->sessions,
                'manual_first_login' => $row->manual_first_login,
                'manual_first_logout' => $row->manual_first_logout,
                'leads_sent' => $row->leads_sent,
                'note' => $row->note,
                'attendance_source' => $row->attendance_source,
            ]);

        return Inertia::render('lead-workflow/data-tele-hours', [
            'hours' => $rows,
            'agents' => $activeAgents->map(fn (Agent $agent): array => [
                'id' => $agent->agent_id,
                'name' => $agent->agent_name,
            ])->values(),
            'editableAgents' => $agents->map(fn (Agent $agent): array => [
                'id' => $agent->agent_id,
                'name' => $agent->agent_name,
            ])->values(),
            'timezone' => $timezone,
            'selectedDate' => $selectedDate->toDateString(),
            'canManageManualHours' => $request->user()?->role === 'admin',
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
                DB::table('agent_hour_exclusions')
                    ->where('agent_id', $agentId)
                    ->whereDate('work_date', $validated['work_date'])
                    ->delete();
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

    public function update(Request $request, int $agentId, string $workDate): RedirectResponse
    {
        $this->authorizeAdmin($request);

        abort_unless(Agent::query()->whereKey($agentId)->exists(), 404);

        $validated = $request->validate([
            'agent_id' => ['required', 'integer', Rule::exists('agents', 'agent_id')],
            'work_date' => ['required', 'date'],
            'first_login' => ['required', 'date_format:H:i'],
            'first_logout' => ['required', 'date_format:H:i', 'after:first_login'],
            'leads_sent' => ['required', 'integer', 'min:0', 'max:100000'],
            'lunch_hours' => ['required', 'numeric', 'min:0', 'max:24'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);
        $durationSeconds = CarbonImmutable::createFromFormat('H:i', $validated['first_login'])
            ->diffInSeconds(CarbonImmutable::createFromFormat('H:i', $validated['first_logout']));
        $lunchSeconds = (int) round(((float) $validated['lunch_hours']) * 3600);

        if ($lunchSeconds > $durationSeconds) {
            throw ValidationException::withMessages([
                'lunch_hours' => 'Lunch cannot be longer than the manual login duration.',
            ]);
        }

        $targetAgentId = (int) $validated['agent_id'];
        $targetWorkDate = CarbonImmutable::parse($validated['work_date'])->toDateString();
        DB::transaction(function () use ($agentId, $workDate, $targetAgentId, $targetWorkDate, $validated, $durationSeconds, $lunchSeconds, $request): void {
            if ($targetAgentId !== $agentId || $targetWorkDate !== $workDate) {
                DB::table('agent_manual_hours')
                    ->where('agent_id', $agentId)
                    ->whereDate('work_date', $workDate)
                    ->delete();
                DB::table('agent_hour_exclusions')->updateOrInsert(
                    ['agent_id' => $agentId, 'work_date' => $workDate],
                    ['deleted_by' => $request->user()->getAuthIdentifier(), 'created_at' => now(), 'updated_at' => now()],
                );
            }
            DB::table('agent_hour_exclusions')
                ->where('agent_id', $targetAgentId)
                ->whereDate('work_date', $targetWorkDate)
                ->delete();
            DB::table('agent_manual_hours')->updateOrInsert(
                ['agent_id' => $targetAgentId, 'work_date' => $targetWorkDate],
                [
                'calltools_first_login_at' => null,
                'calltools_last_logout_at' => null,
                'first_login' => $validated['first_login'],
                'first_logout' => $validated['first_logout'],
                'second_login' => null,
                'second_logout' => null,
                'duration_seconds' => $durationSeconds,
                'imported_seconds_override' => null,
                'leads_sent_override' => $validated['leads_sent'],
                'lunch_seconds' => $lunchSeconds,
                'note' => $validated['note'] ?: null,
                'created_by' => $request->user()->getAuthIdentifier(),
                'created_at' => now(),
                'updated_at' => now(),
                ],
            );
        });

        return back()->with('success', 'Agent hours updated.');
    }

    public function destroy(Request $request, int $agentId, string $workDate): RedirectResponse
    {
        $this->authorizeAdmin($request);

        abort_unless(Agent::query()->whereKey($agentId)->exists(), 404);
        DB::transaction(function () use ($request, $agentId, $workDate): void {
            DB::table('agent_manual_hours')
                ->where('agent_id', $agentId)
                ->whereDate('work_date', $workDate)
                ->delete();
            DB::table('agent_hour_exclusions')->updateOrInsert(
                ['agent_id' => $agentId, 'work_date' => $workDate],
                [
                    'deleted_by' => $request->user()->getAuthIdentifier(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            );
        });

        return back()->with('success', 'Agent Portal hour row removed from both Tele Report views.');
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'admin', 403);
    }

    private function timezone(string $requested): string
    {
        return (string) config('app.timezone', 'America/Los_Angeles');
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

}
