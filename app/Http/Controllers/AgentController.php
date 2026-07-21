<?php

namespace App\Http\Controllers;

use App\Http\Requests\AgentRequest;
use App\Models\Agent;
use App\Models\Account;
use App\Models\Company;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class AgentController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('management/agents', [
            'agents' => Agent::query()->with(['account:acc_id,username', 'company:com_id,company'])->orderBy('agent_name')->get(),
            'companies' => Company::query()->orderBy('company')->get(['com_id', 'company']),
        ]);
    }

    public function store(AgentRequest $request): RedirectResponse
    {
        DB::transaction(function () use ($request): void {
            $data = $request->validated();
            $account = $this->createAccount($data, 'agent');
            Agent::query()->create([
                'agent_name' => $data['agent_name'],
                'company_id' => $data['company_id'],
                'account_id' => $account?->acc_id,
            ]);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Agent created.']);

        return back();
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
            ]);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Agent updated.']);

        return back();
    }

    public function destroy(Agent $agent): RedirectResponse
    {
        abort_unless(request()->user()?->role === 'admin', 403);

        DB::transaction(function () use ($agent): void {
            $account = $agent->account;
            $agent->delete();
            $account?->delete();
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Agent deleted.']);

        return back();
    }

    private function createAccount(array $data, string $role): ?Account
    {
        if (empty($data['username'])) return null;

        return Account::query()->create([
            'username' => $data['username'],
            'password' => $data['password'],
            'role' => $role,
        ]);
    }

    private function syncAccount(?Account $account, array $data, string $role): ?Account
    {
        if (empty($data['username'])) {
            $account?->delete();
            return null;
        }

        if (! $account) return $this->createAccount($data, $role);

        $updates = ['username' => $data['username'], 'role' => $role];
        if (! empty($data['password'])) $updates['password'] = $data['password'];
        $account->update($updates);

        return $account;
    }
}
