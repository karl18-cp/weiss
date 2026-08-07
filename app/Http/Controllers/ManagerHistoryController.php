<?php

namespace App\Http\Controllers;

use App\Models\Manager;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ManagerHistoryController extends Controller
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
        $ownAccountId = $user->role === 'manager' ? $user->acc_id : null;
        $managerAccountId = $canViewAll
            ? ($request->integer('manager') ?: null)
            : $ownAccountId;
        $search = trim((string) $request->query('search', ''));
        $from = $request->date('from')?->startOfDay();
        $to = $request->date('to')?->endOfDay();

        $activities = DB::query()
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
            ->paginate(50)
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
            ]);

        return Inertia::render('management/manager-history', [
            'activities' => $activities,
            'managers' => $canViewAll
                ? Manager::query()->whereNotNull('account_id')->orderBy('manager_name')->get(['manager_id', 'account_id', 'manager_name'])
                : Manager::query()->where('account_id', $ownAccountId)->get(['manager_id', 'account_id', 'manager_name']),
            'filters' => [
                'manager' => $managerAccountId,
                'search' => $search,
                'from' => $request->query('from'),
                'to' => $request->query('to'),
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
