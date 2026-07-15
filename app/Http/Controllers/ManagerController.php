<?php

namespace App\Http\Controllers;

use App\Http\Requests\ManagerRequest;
use App\Models\Account;
use App\Models\Company;
use App\Models\Manager;
use App\Support\ManagerAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ManagerController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('management/managers', [
            'managers' => Manager::query()->with(['account:acc_id,username', 'company:com_id,company', 'permissions'])->orderBy('manager_name')->get(),
            'companies' => Company::query()->orderBy('company')->get(['com_id', 'company']),
            'managerTypes' => ManagerAccess::TYPES,
            'permissionModules' => ManagerAccess::MODULES,
        ]);
    }

    public function store(ManagerRequest $request): RedirectResponse
    {
        DB::transaction(function () use ($request) {
            $data = $request->validated();
            $account = Account::query()->create(['username' => $data['username'], 'password' => $data['password'], 'role' => 'manager']);
            $manager = Manager::query()->create(['account_id' => $account->acc_id, 'manager_name' => $data['manager_name'], 'phone' => $data['phone'], 'company_id' => $data['company_id'], 'manager_types' => $data['manager_types']]);
            $this->syncPermissions($manager, $data['permissions']);
        });
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Manager created.']);

        return back();
    }

    public function update(ManagerRequest $request, Manager $manager): RedirectResponse
    {
        DB::transaction(function () use ($request, $manager) {
            $data = $request->validated();
            $accountData = ['username' => $data['username'], 'role' => 'manager'];
            if (! empty($data['password'])) {
                $accountData['password'] = $data['password'];
            }
            $manager->account->update($accountData);
            $manager->update(['manager_name' => $data['manager_name'], 'phone' => $data['phone'], 'company_id' => $data['company_id'], 'manager_types' => $data['manager_types']]);
            $this->syncPermissions($manager, $data['permissions']);
        });
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Manager updated.']);

        return back();
    }

    public function destroy(Manager $manager): RedirectResponse
    {
        abort_unless(request()->user()?->role === 'admin', 403);
        $manager->account->delete();
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Manager deleted.']);

        return back();
    }

    private function syncPermissions(Manager $manager, array $permissions): void
    {
        foreach (ManagerAccess::MODULES as $module => $label) {
            $manager->permissions()->updateOrCreate(['module' => $module], ['access_level' => $permissions[$module] ?? 'none']);
        }
    }
}
