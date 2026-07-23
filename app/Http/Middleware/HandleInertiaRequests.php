<?php

namespace App\Http\Middleware;

use App\Models\Lead;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
                'permissions' => function () use ($request) {
                    $user = $request->user();
                    $profile = match ($user?->role) {
                        'manager' => $user->manager,
                        'agent' => $user->agent,
                        'salesman' => $user->salesman,
                        default => null,
                    };

                    return $profile?->permissions()->pluck('access_level', 'module') ?? [];
                },
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'importResult' => fn () => $request->session()->get('importResult'),
            'workflowCounts' => function (): array {
                $counts = Lead::query()
                    ->selectRaw('status, COUNT(*) as total')
                    ->groupBy('status')
                    ->pluck('total', 'status');
                $sum = fn (array $statuses): int => collect($statuses)
                    ->sum(fn (string $status): int => (int) ($counts[$status] ?? 0));

                return [
                    'leads_shop' => $sum(Lead::LEADS_SHOP_STATUSES),
                    'confirm_leads' => $sum(['confirmed']),
                    'dispatch_leads' => $sum(['dispatched']),
                    'reschedule' => $sum(['reschedule']),
                    'rehash' => $sum(['rehash', 'rehash_ng', 'rehash_toss', 'rehash_cb']),
                    '555' => $sum(['555']),
                    'la' => $sum(['la']),
                    'his' => $sum(['his']),
                    'keep_in_touch' => $sum(['kit', 'kit_ng', 'kit_toss', 'kit_cb']),
                ];
            },
        ];
    }
}
