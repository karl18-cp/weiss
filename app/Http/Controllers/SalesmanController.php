<?php

namespace App\Http\Controllers;

use App\Http\Requests\SalesmanRequest;
use App\Models\Salesman;
use App\Models\Account;
use App\Models\Company;
use App\Support\ManagerAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SalesmanController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('management/salesmen', [
            'salesmen' => Salesman::query()->with(['account:acc_id,username', 'company:com_id,company', 'permissions'])->orderBy('salesman_name')->get(),
            'companies' => Company::query()->orderBy('company')->get(['com_id', 'company']),
            'permissionModules' => ManagerAccess::MODULES,
        ]);
    }

    public function store(SalesmanRequest $request): RedirectResponse
    {
        DB::transaction(function () use ($request): void {
            $data = $request->validated();
            $account = $this->createAccount($data);
            $salesman = Salesman::query()->create([
                'salesman_name' => $data['salesman_name'],
                'phone' => $data['phone'],
                'company_id' => $data['company_id'],
                'account_id' => $account?->acc_id,
            ]);
            $this->syncPermissions($salesman, $data['permissions']);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Salesman created.']);

        return back();
    }

    public function update(SalesmanRequest $request, Salesman $salesman): RedirectResponse
    {
        DB::transaction(function () use ($request, $salesman): void {
            $data = $request->validated();
            $account = $this->syncAccount($salesman->account, $data);
            $salesman->update([
                'salesman_name' => $data['salesman_name'],
                'phone' => $data['phone'],
                'company_id' => $data['company_id'],
                'account_id' => $account?->acc_id,
            ]);
            $this->syncPermissions($salesman, $data['permissions']);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Salesman updated.']);

        return back();
    }

    public function destroy(Salesman $salesman): RedirectResponse
    {
        abort_unless(request()->user()?->role === 'admin', 403);

        DB::transaction(function () use ($salesman): void {
            $account = $salesman->account;
            $salesman->delete();
            $account?->delete();
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Salesman deleted.']);

        return back();
    }

    private function createAccount(array $data): ?Account
    {
        if (empty($data['username'])) return null;

        return Account::query()->create([
            'username' => $data['username'],
            'password' => $data['password'],
            'role' => 'salesman',
        ]);
    }

    private function syncAccount(?Account $account, array $data): ?Account
    {
        if (empty($data['username'])) {
            $account?->delete();
            return null;
        }

        if (! $account) return $this->createAccount($data);

        $updates = ['username' => $data['username'], 'role' => 'salesman'];
        if (! empty($data['password'])) $updates['password'] = $data['password'];
        $account->update($updates);

        return $account;
    }

    private function syncPermissions(Salesman $salesman, array $permissions): void
    {
        foreach (ManagerAccess::MODULES as $module => $label) {
            $salesman->permissions()->updateOrCreate(
                ['module' => $module],
                ['access_level' => $permissions[$module] ?? 'none'],
            );
        }
    }
}
