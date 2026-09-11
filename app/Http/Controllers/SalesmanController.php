<?php

namespace App\Http\Controllers;

use App\Http\Requests\SalesmanRequest;
use App\Models\Account;
use App\Models\Company;
use App\Models\Lead;
use App\Models\Project;
use App\Models\Salesman;
use App\Services\ProjectCommissionCalculator;
use App\Support\ManagerAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SalesmanController extends Controller
{
    public function __construct(private readonly ProjectCommissionCalculator $commissions) {}

    public function index(): Response
    {
        $salesmen = Salesman::query()
            ->with(['account:acc_id,username,suspended_at', 'company:com_id,company', 'permissions'])
            ->orderBy('salesman_name')
            ->get()
            ->each(function (Salesman $salesman): void {
                $projects = Project::query()
                    ->where('status', 'completed')
                    ->where(function ($query) use ($salesman): void {
                        $query->where('salesman_id', $salesman->salesman_id)
                            ->orWhereHas('lead', fn ($lead) => $lead
                                ->where('salesman_1_id', $salesman->salesman_id)
                                ->orWhere('salesman_2_id', $salesman->salesman_id))
                            ->orWhereHas('sales', fn ($sales) => $sales
                                ->where('type', 'referral')
                                ->where('salesman_id', $salesman->salesman_id));
                    })
                    ->with([
                        'lead:id,salesman_1_id',
                        'sales:id,project_id,type,amount,salesman_id',
                        'accountingTransactions:id,project_id,project_sale_id,salesman_id,type,category,amount,status',
                    ])
                    ->get();
                $breakdowns = $projects->map(
                    fn (Project $project): array => $this->commissions->calculate($project, $salesman),
                );
                $salesman->setAttribute('completed_projects_count', $projects->count());
                $salesman->setAttribute('completed_sales_total', round($breakdowns->sum('total_sale'), 2));
                $salesman->setAttribute('completed_cut_total', round($breakdowns->sum('commission_due'), 2));
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
                'shared_sale_commission_percent' => $data['shared_sale_commission_percent'],
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
                ->orWhere('salesman_2_id', $salesman->salesman_id)
                ->orWhereHas('project.sales', fn ($sales) => $sales
                    ->where('type', 'referral')
                    ->where('salesman_id', $salesman->salesman_id));
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
                'project.sales:id,project_id,type,amount,sale_date,salesman_id',
            ])
            ->latest('appointment_at')
            ->limit(300)
            ->get()
            ->map(function ($lead) use ($confirmedStatuses, $salesman): array {
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
                    'sale_total' => $project
                        ? (in_array((int) $salesman->salesman_id, [
                            (int) $lead->salesman_1_id,
                            (int) $lead->salesman_2_id,
                        ], true)
                            ? (float) ($project->sales->sum('amount') ?: $project->amount)
                            : (float) $project->sales
                                ->where('type', 'referral')
                                ->where('salesman_id', $salesman->salesman_id)
                                ->sum('amount'))
                        : 0,
                    'city' => $lead->city,
                    'notes' => $lead->notes->sortByDesc('id')->pluck('body')->filter()->take(3)->join(' | '),
                ];
            });

        $soldQuery = (clone $base)->whereHas('project');
        $saleTotal = $rows->where('sold', true)->sum('sale_total');

        $completedProjects = Project::query()
            ->where('status', 'completed')
            ->where(function ($query) use ($salesman): void {
                $query->where('salesman_id', $salesman->salesman_id)
                    ->orWhereHas('lead', fn ($lead) => $lead
                        ->where('salesman_1_id', $salesman->salesman_id)
                        ->orWhere('salesman_2_id', $salesman->salesman_id))
                    ->orWhereHas('sales', fn ($sales) => $sales
                        ->where('type', 'referral')
                        ->where('salesman_id', $salesman->salesman_id));
            })
            ->with([
                'lead:id,customer_name,city,salesman_1_id,salesman_2_id',
                'company:com_id,company,prefix',
                'sales:id,project_id,type,amount,sale_date,salesman_id',
                'accountingTransactions:id,project_id,project_sale_id,salesman_id,type,category,amount,status,transaction_date',
                'invoices:id,project_id,amount,status',
            ])
            ->latest('updated_at')
            ->get();

        $commissionRows = $completedProjects->map(function ($project) use ($salesman): array {
            $calculation = $this->commissions->calculate($project, $salesman);
            $received = (float) $calculation['received'];

            return [
                'project_id' => $project->id,
                'project_number' => $project->project_number ?: (($project->company?->prefix ?: 'PROJECT').'-'.str_pad((string) $project->id, 5, '0', STR_PAD_LEFT)),
                'customer' => $project->customer_name ?: $project->lead?->customer_name ?: '—',
                'company' => $project->company?->company ?: '—',
                'city' => $project->city ?: $project->lead?->city ?: '—',
                'completed_at' => $project->updated_at?->toIso8601String(),
                'original_sale' => round($calculation['original_sale'], 2),
                'change_orders' => round($calculation['change_orders'], 2),
                'total_sale' => round($calculation['total_sale'], 2),
                'received' => round($received, 2),
                'expenses' => round($calculation['expenses'], 2),
                'project_balance' => round($calculation['total_sale'] - $received, 2),
                'initial_cut' => round($calculation['lead_cost'], 2),
                'change_order_cut' => round($calculation['change_order_lead_cost'], 2),
                'commission_base' => round($calculation['commission_base'], 2),
                'sale_commission' => round($calculation['commission_due'], 2),
                'commission_due' => round($calculation['commission_due'], 2),
                'commission_paid' => round($calculation['commission_paid'], 2),
                'commission_balance' => round($calculation['commission_balance'], 2),
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
                    'shared_sale_commission' => (float) $salesman->shared_sale_commission_percent,
                ],
                'summary' => [
                    'projects' => $commissionRows->count(),
                    'sales' => round($commissionRows->sum('total_sale'), 2),
                    'received' => round($commissionRows->sum('received'), 2),
                    'expenses' => round($commissionRows->sum('expenses'), 2),
                    'balance' => round($commissionRows->sum('project_balance'), 2),
                    'commission_due' => round($commissionRows->sum('commission_due'), 2),
                    'commission_paid' => round($commissionRows->sum('commission_paid'), 2),
                    'commission_balance' => round($commissionRows->sum('commission_balance'), 2),
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
                'shared_sale_commission_percent' => $data['shared_sale_commission_percent'],
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
