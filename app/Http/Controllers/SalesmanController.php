<?php

namespace App\Http\Controllers;

use App\Http\Requests\SalesmanRequest;
use App\Models\Account;
use App\Models\Company;
use App\Models\Lead;
use App\Models\Salesman;
use App\Support\ManagerAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SalesmanController extends Controller
{
    public function index(): Response
    {
        $salesmen = Salesman::query()
            ->with(['account:acc_id,username,suspended_at', 'company:com_id,company', 'permissions'])
            ->withCount(['projects as completed_projects_count' => fn ($query) => $query->where('status', 'completed')])
            ->with(['projects' => fn ($query) => $query->where('status', 'completed')->with('sales:id,project_id,type,amount')])
            ->orderBy('salesman_name')
            ->get()
            ->each(function (Salesman $salesman): void {
                $initial = $salesman->projects->sum(fn ($project) => (float) ($project->sales->firstWhere('type', 'original')?->amount ?? $project->amount ?? 0));
                $changes = $salesman->projects->sum(fn ($project) => (float) $project->sales->where('type', '!=', 'original')->sum('amount'));
                $total = $initial + $changes;
                $salesman->setAttribute('completed_sales_total', round($total, 2));
                $salesman->setAttribute('completed_cut_total', round(
                    ($initial * (float) $salesman->initial_sale_cut_percent / 100)
                    + ($changes * (float) $salesman->change_order_cut_percent / 100)
                    + ($total * (float) $salesman->sale_commission_percent / 100),
                    2,
                ));
                $salesman->unsetRelation('projects');
            });

        return Inertia::render('management/salesmen', [
            'salesmen' => $salesmen,
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
                'inactive_at' => ($data['suspended'] ?? false) ? now() : null,
                'initial_sale_cut_percent' => $data['initial_sale_cut_percent'],
                'change_order_cut_percent' => $data['change_order_cut_percent'],
                'sale_commission_percent' => $data['sale_commission_percent'],
            ]);
            $this->syncPermissions($salesman, $data['permissions']);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Salesman created.']);

        return back();
    }

    public function report(Salesman $salesman): JsonResponse
    {
        $base = Lead::query()->where(function ($query) use ($salesman): void {
            $query->where('salesman_1_id', $salesman->salesman_id)
                ->orWhere('salesman_2_id', $salesman->salesman_id);
        });
        $confirmedStatuses = ['confirmed', 'dispatched', 'project'];
        $isConfirmed = fn ($query) => $query->whereIn('status', $confirmedStatuses)
            ->orWhereHas('movements', fn ($movement) => $movement->whereIn('to_status', $confirmedStatuses));
        $isDispatched = fn ($query) => $query->where('status', 'dispatched')
            ->orWhereHas('movements', fn ($movement) => $movement->where('to_status', 'dispatched'));

        $rows = (clone $base)
            ->withExists('project')
            ->with([
                'company:com_id,prefix',
                'notes:id,lead_id,body,created_at',
                'movements:id,lead_id,to_status,created_at',
                'project:id,lead_id,project_number,amount',
                'project.sales:id,project_id,amount,sale_date',
            ])
            ->latest('appointment_at')
            ->limit(300)
            ->get()
            ->map(function ($lead) use ($confirmedStatuses): array {
                $movementStatuses = $lead->movements->pluck('to_status');
                $project = $lead->project;
                $projectNumber = $project
                    ? ($project->project_number ?: (($lead->company?->prefix ?: 'PROJECT').'-'.str_pad((string) $project->id, 5, '0', STR_PAD_LEFT)))
                    : '—';

                return [
                    'id' => $lead->id,
                    'origin_at' => $lead->created_at?->toIso8601String(),
                    'appointment_at' => $lead->appointment_at?->toIso8601String(),
                    'customer' => $lead->customer_name,
                    'result' => ucwords(str_replace('_', ' ', $lead->status ?: 'fresh')),
                    'confirmed' => in_array($lead->status, $confirmedStatuses, true)
                        || $movementStatuses->intersect($confirmedStatuses)->isNotEmpty(),
                    'dispatched' => $lead->status === 'dispatched' || $movementStatuses->contains('dispatched'),
                    'sold' => (bool) $lead->project_exists,
                    'project_id' => $project?->id,
                    'project_number' => $projectNumber,
                    'sale_total' => $project ? (float) ($project->sales->sum('amount') ?: $project->amount) : 0,
                    'city' => $lead->city,
                    'notes' => $lead->notes->sortByDesc('id')->pluck('body')->filter()->take(3)->join(' | '),
                ];
            });

        $soldQuery = (clone $base)->whereHas('project');
        $saleTotal = $rows->where('sold', true)->sum('sale_total');

        $completedProjects = $salesman->projects()
            ->where('status', 'completed')
            ->with([
                'lead:id,customer_name,city',
                'company:com_id,company,prefix',
                'sales:id,project_id,type,amount,sale_date',
                'accountingTransactions:id,project_id,type,category,amount,status,transaction_date',
                'invoices:id,project_id,amount,status',
            ])
            ->latest('updated_at')
            ->get();

        $commissionRows = $completedProjects->map(function ($project) use ($salesman): array {
            $originalSale = (float) ($project->sales->firstWhere('type', 'original')?->amount ?? $project->amount ?? 0);
            $changeOrders = (float) $project->sales->where('type', '!=', 'original')->sum('amount');
            $totalSale = $originalSale + $changeOrders;
            $received = (float) $project->accountingTransactions
                ->where('type', 'receivable')->where('status', 'deposit')->sum('amount');
            $expenses = (float) $project->accountingTransactions
                ->where('type', 'payable')->where('status', 'paid')->sum('amount');
            $initialCut = $originalSale * (float) $salesman->initial_sale_cut_percent / 100;
            $changeCut = $changeOrders * (float) $salesman->change_order_cut_percent / 100;
            $saleCommission = $totalSale * (float) $salesman->sale_commission_percent / 100;
            $commissionDue = $initialCut + $changeCut + $saleCommission;

            return [
                'project_id' => $project->id,
                'project_number' => $project->project_number ?: (($project->company?->prefix ?: 'PROJECT').'-'.str_pad((string) $project->id, 5, '0', STR_PAD_LEFT)),
                'customer' => $project->customer_name ?: $project->lead?->customer_name ?: '—',
                'company' => $project->company?->company ?: '—',
                'city' => $project->city ?: $project->lead?->city ?: '—',
                'completed_at' => $project->updated_at?->toIso8601String(),
                'original_sale' => round($originalSale, 2),
                'change_orders' => round($changeOrders, 2),
                'total_sale' => round($totalSale, 2),
                'received' => round($received, 2),
                'expenses' => round($expenses, 2),
                'project_balance' => round($totalSale - $received, 2),
                'initial_cut' => round($initialCut, 2),
                'change_order_cut' => round($changeCut, 2),
                'sale_commission' => round($saleCommission, 2),
                'commission_due' => round($commissionDue, 2),
            ];
        });

        return response()->json([
            'salesman' => ['id' => $salesman->salesman_id, 'name' => $salesman->salesman_name],
            'summary' => [
                'appointments' => (clone $base)->whereNotNull('appointment_at')->count(),
                'confirmed' => (clone $base)->where($isConfirmed)->count(),
                'dispatched' => (clone $base)->where($isDispatched)->count(),
                'sold' => (clone $soldQuery)->count(),
                'sale_total' => $saleTotal,
                'last_sale' => (clone $soldQuery)->max('appointment_at'),
            ],
            'rows' => $rows,
            'commission' => [
                'rates' => [
                    'initial_sale' => (float) $salesman->initial_sale_cut_percent,
                    'change_order' => (float) $salesman->change_order_cut_percent,
                    'sale_commission' => (float) $salesman->sale_commission_percent,
                ],
                'summary' => [
                    'projects' => $commissionRows->count(),
                    'sales' => round($commissionRows->sum('total_sale'), 2),
                    'received' => round($commissionRows->sum('received'), 2),
                    'expenses' => round($commissionRows->sum('expenses'), 2),
                    'balance' => round($commissionRows->sum('project_balance'), 2),
                    'commission_due' => round($commissionRows->sum('commission_due'), 2),
                ],
                'rows' => $commissionRows,
            ],
        ]);
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
                'inactive_at' => ($data['suspended'] ?? false)
                    ? ($salesman->inactive_at ?? now())
                    : null,
                'initial_sale_cut_percent' => $data['initial_sale_cut_percent'],
                'change_order_cut_percent' => $data['change_order_cut_percent'],
                'sale_commission_percent' => $data['sale_commission_percent'],
            ]);
            $this->syncPermissions($salesman, $data['permissions']);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Salesman updated.']);

        return back();
    }

    public function destroy(Salesman $salesman): RedirectResponse
    {

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
        if (empty($data['username'])) {
            return null;
        }

        return Account::query()->create([
            'username' => $data['username'],
            'password' => $data['password'],
            'role' => 'salesman',
            'suspended_at' => ($data['suspended'] ?? false) ? now() : null,
        ]);
    }

    private function syncAccount(?Account $account, array $data): ?Account
    {
        if (empty($data['username'])) {
            $account?->delete();

            return null;
        }

        if (! $account) {
            return $this->createAccount($data);
        }

        $updates = [
            'username' => $data['username'],
            'role' => 'salesman',
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
