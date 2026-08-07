<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\Manager;
use App\Models\RingCentralCall;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ManagerActivityController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        abort_unless(in_array($user->role, ['admin', 'manager'], true), 403);

        $canViewAll = $user->role === 'admin'
            || $user->manager?->permissions()
                ->where('module', 'manager_history')
                ->whereIn('access_level', ['view', 'edit'])
                ->exists();
        $ownAccountId = $user->role === 'manager' ? (int) $user->acc_id : null;
        $managerAccountId = $canViewAll
            ? ($request->integer('manager') ?: null)
            : $ownAccountId;
        $search = trim((string) $request->query('search', ''));
        $talkedTo = $request->boolean('talked_to');
        $callSort = (string) $request->query('call_sort', 'date');
        $callDirection = $request->query('call_direction') === 'asc' ? 'asc' : 'desc';
        $callSort = in_array($callSort, ['date', 'manager', 'lead', 'result', 'duration'], true)
            ? $callSort
            : 'date';
        $view = $request->query('view') === 'history' ? 'history' : 'calls';
        $californiaTimezone = 'America/Los_Angeles';
        $today = CarbonImmutable::now($californiaTimezone)->toDateString();
        $fromValue = (string) $request->query('from', $today);
        $toValue = (string) $request->query('to', $today);
        $from = CarbonImmutable::parse($fromValue, $californiaTimezone)->startOfDay();
        $to = CarbonImmutable::parse($toValue, $californiaTimezone)->endOfDay();

        $activities = $view === 'history'
            ? DB::query()
                ->fromSub($this->activityUnion(), 'activity')
                ->join('leads', 'leads.id', '=', 'activity.lead_id')
                ->join('accounts', 'accounts.acc_id', '=', 'activity.actor_id')
                ->join('managers', 'managers.account_id', '=', 'accounts.acc_id')
                ->leftJoin('agents', 'agents.agent_id', '=', 'activity.target_id')
                ->when($managerAccountId, fn (Builder $query) => $query->where('activity.actor_id', $managerAccountId))
                ->when($from, fn (Builder $query) => $query->where('activity.created_at', '>=', $from))
                ->when($to, fn (Builder $query) => $query->where('activity.created_at', '<=', $to))
                ->when($search !== '', function (Builder $query) use ($search): void {
                    $like = '%'.$search.'%';
                    $query->where(function (Builder $query) use ($like): void {
                        $query->where('leads.customer_name', 'like', $like)
                            ->orWhere('leads.address', 'like', $like)
                            ->orWhere('leads.city', 'like', $like)
                            ->orWhere('managers.manager_name', 'like', $like);
                    });
                })
                ->select([
                    'activity.activity_id', 'activity.activity_type', 'activity.subtype',
                    'activity.from_status', 'activity.to_status', 'activity.body',
                    'activity.created_at', 'leads.id as lead_id', 'leads.customer_name',
                    'leads.city', 'leads.status as current_status', 'managers.manager_name',
                    'accounts.acc_id as manager_account_id', 'agents.agent_name as target_name',
                ])
                ->orderByDesc('activity.created_at')
                ->orderByDesc('activity.activity_id')
                ->paginate(40, ['*'], 'history_page')
                ->withQueryString()
                ->through(fn (object $row): array => [
                    'id' => $row->activity_type.'-'.$row->activity_id,
                    'lead_id' => (int) $row->lead_id,
                    'customer_name' => $row->customer_name,
                    'city' => $row->city,
                    'current_status' => $row->current_status,
                    'manager_name' => $row->manager_name,
                    'manager_account_id' => (int) $row->manager_account_id,
                    'activity_type' => $row->activity_type,
                    'description' => $this->description($row),
                    'created_at' => $row->created_at,
                ])
            : new LengthAwarePaginator(
                items: [],
                total: 0,
                perPage: 40,
                currentPage: 1,
                options: [
                    'path' => $request->url(),
                    'pageName' => 'history_page',
                    'query' => $request->query(),
                ],
            );

        $managerNames = Manager::query()
            ->whereNotNull('account_id')
            ->pluck('manager_name', 'account_id');
        $calls = RingCentralCall::query()
            ->whereIn('account_id', $managerNames->keys())
            ->when($managerAccountId, fn ($query) => $query->where('account_id', $managerAccountId))
            ->when($from, fn ($query) => $query->where('initiated_at', '>=', $from))
            ->when($to, fn ($query) => $query->where('initiated_at', '<=', $to))
            ->when($talkedTo, fn ($query) => $query->where('duration_seconds', '>', 20))
            ->when($search !== '', function ($query) use ($search): void {
                $like = '%'.$search.'%';
                $query->where(function ($query) use ($like): void {
                    $query->where('phone_number', 'like', $like)
                        ->orWhereHas('lead', function ($lead) use ($like): void {
                            $lead->where('customer_name', 'like', $like)
                                ->orWhere('address', 'like', $like)
                                ->orWhere('city', 'like', $like);
                        })
                        ->orWhereHas('caller.manager', fn ($manager) => $manager->where('manager_name', 'like', $like));
                });
            })
            ->with([
                'caller:acc_id,username,role',
                'lead:id,customer_name,address,city,state,zip_code,status',
            ])
            ->when($callSort === 'date', fn ($query) => $query->orderBy('initiated_at', $callDirection))
            ->when($callSort === 'manager', fn ($query) => $query->orderBy(
                Manager::query()->select('manager_name')->whereColumn('managers.account_id', 'ringcentral_calls.account_id'),
                $callDirection,
            ))
            ->when($callSort === 'lead', fn ($query) => $query->orderBy(
                Lead::query()->select('customer_name')->whereColumn('leads.id', 'ringcentral_calls.lead_id'),
                $callDirection,
            ))
            ->when($callSort === 'result', fn ($query) => $query->orderBy('result', $callDirection))
            ->when($callSort === 'duration', fn ($query) => $query->orderBy('duration_seconds', $callDirection))
            ->orderByDesc('id')
            ->paginate(40, ['*'], 'calls_page')
            ->withQueryString()
            ->through(function (RingCentralCall $call) use ($managerNames): array {
                return [
                    ...$call->toArray(),
                    'manager_name' => $managerNames->get($call->account_id, $call->caller?->username ?? 'Manager'),
                    'recording_url' => $call->recording_path
                        ? route('lead-workflow.leads-shop.ringcentral-calls.recording', [$call->lead_id, $call->id])
                        : null,
                ];
            });

        return Inertia::render('lead-workflow/manager-activity', [
            'activities' => $activities,
            'calls' => $calls,
            'managers' => $canViewAll
                ? Manager::query()
                    ->whereNotNull('account_id')
                    ->whereHas('account', fn ($account) => $account->whereNull('suspended_at'))
                    ->orderBy('manager_name')
                    ->get(['manager_id', 'account_id', 'manager_name'])
                : Manager::query()
                    ->where('account_id', $ownAccountId)
                    ->whereHas('account', fn ($account) => $account->whereNull('suspended_at'))
                    ->get(['manager_id', 'account_id', 'manager_name']),
            'filters' => [
                'manager' => $managerAccountId,
                'search' => $search,
                'from' => $fromValue,
                'to' => $toValue,
                'view' => $view,
                'talked_to' => $talkedTo,
                'call_sort' => $callSort,
                'call_direction' => $callDirection,
            ],
            'canViewAll' => $canViewAll,
        ]);
    }

    private function activityUnion(): Builder
    {
        $movements = DB::table('lead_movements')->select([
            'id as activity_id', 'lead_id', 'moved_by as actor_id',
            DB::raw("'movement' as activity_type"), DB::raw('NULL as subtype'),
            'from_status', 'to_status', DB::raw('NULL as body'),
            DB::raw('NULL as target_id'), 'created_at',
        ])->whereNotNull('moved_by');

        $notes = DB::table('lead_notes')->select([
            'id as activity_id', 'lead_id', 'created_by as actor_id',
            DB::raw("'note' as activity_type"), 'note_type as subtype',
            DB::raw('NULL as from_status'), DB::raw('NULL as to_status'), 'body',
            DB::raw('NULL as target_id'), 'created_at',
        ]);

        $assignments = DB::table('lead_agent_assignments')->select([
            'id as activity_id', 'lead_id', 'assigned_by as actor_id',
            DB::raw("'assignment' as activity_type"), DB::raw('NULL as subtype'),
            DB::raw('NULL as from_status'), DB::raw('NULL as to_status'),
            DB::raw('NULL as body'), 'agent_id as target_id', 'created_at',
        ])->whereNotNull('assigned_by');

        return $movements->unionAll($notes)->unionAll($assignments);
    }

    private function description(object $row): string
    {
        if ($row->activity_type === 'movement') {
            return 'Moved lead from '.($row->from_status ?: 'New').' to '.$row->to_status.'.';
        }

        if ($row->activity_type === 'assignment') {
            return 'Assigned '.($row->target_name ?: 'an agent').' to the lead.';
        }

        $label = str_replace('_', ' ', (string) $row->subtype);
        $body = trim((string) $row->body);

        return 'Added '.$label.' note'.($body !== '' ? ': '.$body : '.');
    }
}
