<?php

namespace App\Http\Controllers;

use App\Http\Requests\ManagerRequest;
use App\Models\Account;
use App\Models\Company;
use App\Models\Manager;
use App\Support\ManagerAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ManagerController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('management/managers', [
            'managers' => Manager::query()->with(['account:acc_id,username,suspended_at', 'company:com_id,company', 'companies:com_id,company', 'permissions'])->orderBy('manager_name')->get(),
            'companies' => Company::query()->orderBy('company')->get(['com_id', 'company']),
            'managerTypes' => ManagerAccess::TYPES,
            'permissionModules' => ManagerAccess::MODULES,
        ]);
    }

    public function store(ManagerRequest $request): RedirectResponse
    {
        DB::transaction(function () use ($request) {
            $data = $request->validated();
            $account = Account::query()->create([
                'username' => $data['username'],
                'password' => $data['password'],
                'role' => 'manager',
                'suspended_at' => ($data['suspended'] ?? false) ? now() : null,
            ]);
            $manager = Manager::query()->create(['account_id' => $account->acc_id, 'manager_name' => $data['manager_name'], 'phone' => $data['phone'], 'company_id' => $data['company_ids'][0], 'manager_types' => $data['manager_types']]);
            $manager->companies()->sync($data['company_ids']);
            $this->syncPermissions($manager, $data['permissions']);
        });
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Manager created.']);

        return back();
    }

    public function report(Manager $manager): JsonResponse
    {
        $base = $manager->secondaryLeads();
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
            ->latest('updated_at')
            ->limit(300)
            ->get()
            ->map(function ($lead) use ($confirmedStatuses): array {
                $movementStatuses = $lead->movements->pluck('to_status');

                return [
                    'id' => $lead->id,
                    'origin_at' => $lead->created_at?->toIso8601String(),
                    'appointment_at' => $lead->appointment_at?->toIso8601String(),
                    'customer' => $lead->customer_name,
                    'result' => ucwords(str_replace('_', ' ', $lead->status ?: 'fresh')),
                    'confirmed' => in_array($lead->status, $confirmedStatuses, true)
                        || $movementStatuses->intersect($confirmedStatuses)->isNotEmpty(),
                    'dispatched' => $lead->status === 'dispatched'
                        || $movementStatuses->contains('dispatched'),
                    'sold' => (bool) $lead->project_exists,
                    'city' => $lead->city,
                    'notes' => $lead->notes->sortByDesc('id')->pluck('body')->filter()->take(3)->join(' | '),
                ];
            });

        $soldQuery = (clone $base)->whereHas('project');

        return response()->json([
            'manager' => ['id' => $manager->manager_id, 'name' => $manager->manager_name],
            'summary' => [
                'leads' => (clone $base)->count(),
                'confirmed' => (clone $base)->where($isConfirmed)->count(),
                'dispatched' => (clone $base)->where($isDispatched)->count(),
                'sold' => (clone $soldQuery)->count(),
                'last_sale' => (clone $soldQuery)->max('appointment_at'),
            ],
            'rows' => $rows,
        ]);
    }

    public function update(ManagerRequest $request, Manager $manager): RedirectResponse
    {
        DB::transaction(function () use ($request, $manager) {
            $data = $request->validated();
            $accountData = [
                'username' => $data['username'],
                'role' => 'manager',
                'suspended_at' => array_key_exists('suspended', $data)
                    ? ($data['suspended'] ? ($manager->account->suspended_at ?? now()) : null)
                    : $manager->account->suspended_at,
            ];
            if (! empty($data['password'])) {
                $accountData['password'] = $data['password'];
            }
            $manager->account->update($accountData);
            $manager->update(['manager_name' => $data['manager_name'], 'phone' => $data['phone'], 'company_id' => $data['company_ids'][0], 'manager_types' => $data['manager_types']]);
            $manager->companies()->sync($data['company_ids']);
            $this->syncPermissions($manager, $data['permissions']);
        });
        Inertia::flash('toast', ['type' => 'success', 'message' => 'Manager updated.']);

        return back();
    }

    public function destroy(Manager $manager): RedirectResponse
    {
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
