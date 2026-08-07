<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\RingCentralCall;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CallLogController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $canViewAllCalls = in_array($user?->role, ['admin', 'manager'], true);
        $calls = RingCentralCall::query()
            ->when(! $canViewAllCalls, fn ($query) => $query->where('account_id', $user->getAuthIdentifier()))
            ->with([
                'caller:acc_id,username,role',
                'lead:id,customer_name,address,city,state,zip_code',
            ])
            ->latest('initiated_at')
            ->get();

        $users = $canViewAllCalls
            ? Account::query()
                ->whereIn('acc_id', $calls->pluck('account_id')->unique())
                ->get(['acc_id', 'username', 'role'])
                ->map(function (Account $account) use ($calls): array {
                    $userCalls = $calls->where('account_id', $account->acc_id);

                    return [
                        'acc_id' => $account->acc_id,
                        'username' => $account->username,
                        'role' => $account->role,
                        'attempts' => $userCalls->count(),
                        'leads' => $userCalls->pluck('lead_id')->unique()->count(),
                    ];
                })
                ->sortByDesc('attempts')
                ->values()
            : collect();

        return Inertia::render('lead-workflow/call-logs', [
            'calls' => $calls,
            'users' => $users,
            'isAdmin' => $canViewAllCalls,
            'viewerId' => $user?->getAuthIdentifier(),
        ]);
    }
}
