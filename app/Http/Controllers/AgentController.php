<?php

namespace App\Http\Controllers;

use App\Http\Requests\AgentRequest;
use App\Models\Account;
use App\Models\Agent;
use App\Models\AgentSchedule;
use App\Models\Company;
use App\Support\ManagerAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class AgentController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('management/agents', [
            'agents' => Agent::query()->with(['account:acc_id,username,suspended_at', 'company:com_id,company', 'permissions'])->orderBy('agent_name')->get(),
            'companies' => Company::query()->orderBy('company')->get(['com_id', 'company']),
            'permissionModules' => ManagerAccess::MODULES,
        ]);
    }

    public function store(AgentRequest $request): RedirectResponse
    {
        DB::transaction(function () use ($request): void {
            $data = $request->validated();
            $templateAgentId = AgentSchedule::query()->latest('updated_at')->value('agent_id');
            $sharedSchedule = $templateAgentId
                ? AgentSchedule::query()->where('agent_id', $templateAgentId)->get()
                : collect();
            $account = $this->createAccount($data, 'agent');
            $agent = Agent::query()->create([
                'agent_name' => $data['agent_name'],
                'company_id' => $data['company_id'],
                'account_id' => $account?->acc_id,
                'inactive_at' => ($data['suspended'] ?? false) ? now() : null,
            ]);
            if (! $agent->inactive_at) {
                $sharedSchedule->each(fn (AgentSchedule $day) => AgentSchedule::query()->create([
                    'agent_id' => $agent->agent_id,
                    ...$day->only(['weekday', 'is_working', 'shift_start', 'shift_end', 'lunch_start', 'lunch_end']),
                ]));
            }
            $this->syncPermissions($agent, $data['permissions']);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Agent created.']);

        return back();
    }

    public function report(Agent $agent): JsonResponse
    {
        $base = $agent->leads()->whereNotNull('appointment_at');
        $confirmedStatuses = ['confirmed', 'dispatched', 'project'];

        $isConfirmed = fn ($query) => $query->whereIn('status', $confirmedStatuses)
            ->orWhereHas('movements', fn ($movement) => $movement->whereIn('to_status', $confirmedStatuses));
        $isDispatched = fn ($query) => $query->where('status', 'dispatched')
            ->orWhereHas('movements', fn ($movement) => $movement->where('to_status', 'dispatched'));

        $rows = (clone $base)
            ->withExists('project')
            ->with([
                'notes:id,lead_id,note_type,body,created_at',
                'movements:id,lead_id,to_status,created_at',
            ])
            ->latest('appointment_at')
            ->limit(300)
            ->get()
            ->map(function ($lead) use ($confirmedStatuses): array {
                $movementStatuses = $lead->movements->pluck('to_status');
                $confirmed = in_array($lead->status, $confirmedStatuses, true)
                    || $movementStatuses->intersect($confirmedStatuses)->isNotEmpty();
                $dispatched = $lead->status === 'dispatched'
                    || $movementStatuses->contains('dispatched');

                return [
                    'id' => $lead->id,
                    'origin_at' => $lead->created_at?->toIso8601String(),
                    'appointment_at' => $lead->appointment_at?->toIso8601String(),
                    'customer' => $lead->customer_name,
                    'result' => ucwords(str_replace('_', ' ', $lead->status ?: 'fresh')),
                    'confirmed' => $confirmed,
                    'dispatched' => $dispatched,
                    'sold' => (bool) $lead->project_exists,
                    'city' => $lead->city,
                    'notes' => $lead->notes->sortByDesc('id')->pluck('body')->filter()->take(3)->join(' | '),
                ];
            });

        $soldQuery = (clone $base)->whereHas('project');

        return response()->json([
            'agent' => ['id' => $agent->agent_id, 'name' => $agent->agent_name],
            'summary' => [
                'appointments' => (clone $base)->count(),
                'confirmed' => (clone $base)->where($isConfirmed)->count(),
                'dispatched' => (clone $base)->where($isDispatched)->count(),
                'sold' => (clone $soldQuery)->count(),
                'last_sale' => (clone $soldQuery)->max('appointment_at'),
            ],
            'rows' => $rows,
        ]);
    }

    public function update(AgentRequest $request, Agent $agent): RedirectResponse
    {
        DB::transaction(function () use ($request, $agent): void {
            $data = $request->validated();
            $account = $this->syncAccount($agent->account, $data, 'agent');
            $agent->update([
                'agent_name' => $data['agent_name'],
                'company_id' => $data['company_id'],
                'account_id' => $account?->acc_id,
                'inactive_at' => ($data['suspended'] ?? false)
                    ? ($agent->inactive_at ?? now())
                    : null,
            ]);
            $this->syncPermissions($agent, $data['permissions']);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Agent updated.']);

        return back();
    }

    public function destroy(Agent $agent): RedirectResponse
    {
        $movedToInactive = false;

        DB::transaction(function () use ($agent, &$movedToInactive): void {
            $account = $agent->account;

            if ($agent->leads()->exists()) {
                $inactiveAt = $agent->inactive_at ?? now();

                $agent->update(['inactive_at' => $inactiveAt]);
                $account?->update([
                    'suspended_at' => $account->suspended_at ?? $inactiveAt,
                ]);
                $movedToInactive = true;

                return;
            }

            $agent->delete();
            $account?->delete();
        });

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $movedToInactive
                ? 'Agent has existing lead history and was moved to Inactive.'
                : 'Agent deleted.',
        ]);

        return back();
    }

    private function createAccount(array $data, string $role): ?Account
    {
        if (empty($data['username'])) {
            return null;
        }

        return Account::query()->create([
            'username' => $data['username'],
            'password' => $data['password'],
            'role' => $role,
            'suspended_at' => ($data['suspended'] ?? false) ? now() : null,
        ]);
    }

    private function syncAccount(?Account $account, array $data, string $role): ?Account
    {
        if (empty($data['username'])) {
            $account?->delete();

            return null;
        }

        if (! $account) {
            return $this->createAccount($data, $role);
        }

        $updates = [
            'username' => $data['username'],
            'role' => $role,
            'suspended_at' => array_key_exists('suspended', $data)
                ? ($data['suspended'] ? ($account->suspended_at ?? now()) : null)
                : $account->suspended_at,
        ];
        if (! empty($data['password'])) {
            $updates['password'] = $data['password'];
        }
        $account->update($updates);

        return $account;
    }

    private function syncPermissions(Agent $agent, array $permissions): void
    {
        foreach (ManagerAccess::MODULES as $module => $label) {
            $agent->permissions()->updateOrCreate(
                ['module' => $module],
                ['access_level' => $permissions[$module] ?? 'none'],
            );
        }
    }
}
