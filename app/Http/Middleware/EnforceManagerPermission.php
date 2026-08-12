<?php

namespace App\Http\Middleware;

use App\Support\ManagerAccess;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnforceManagerPermission
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user || $user->role === 'admin') {
            return $next($request);
        }

        $permissionPath = $request->path();
        if ($user->role === 'agent' && ! str_starts_with($permissionPath, 'agent/')) {
            if ($request->isMethod('GET')) {
                return redirect()->route('agent.dashboard');
            }

            abort(403, 'Agent accounts use the dedicated time clock workspace.');
        }
        if ($user->role === 'salesman' && ! str_starts_with($permissionPath, 'salesman/')) {
            if ($request->isMethod('GET')) {
                return redirect()->route('salesman.booking-board');
            }

            abort(403, 'Salesman accounts use the dedicated salesman workspace.');
        }
        if (
            $user->role === 'manager'
            && $request->isMethod('GET')
            && preg_match('#^lead-workflow/leads-shop/\d+/ringcentral-calls/\d+/recording$#', $permissionPath) === 1
        ) {
            return $next($request);
        }
        $isLeadsShopStatusAction = ! $request->isMethod('GET')
            && preg_match('#^lead-workflow/leads-shop/\d+/status$#', $permissionPath) === 1;
        if (! $request->isMethod('GET') && str_starts_with($permissionPath, 'lead-workflow/leads-shop/')) {
            $previousPath = parse_url(url()->previous(), PHP_URL_PATH);
            if (is_string($previousPath)) {
                $permissionPath = ltrim($previousPath, '/');
            }
        }

        $module = $this->moduleFor($permissionPath);
        if (! $module) {
            return $next($request);
        }

        $profile = match ($user->role) {
            'manager' => $user->manager,
            'agent' => $user->agent,
            'salesman' => $user->salesman,
            default => null,
        };
        $level = $profile?->permissions()->where('module', $module)->value('access_level') ?? 'none';
        $allowed = $request->isMethod('GET') || ($isLeadsShopStatusAction && $module === 'leads_shop')
            ? in_array($level, ['view', 'edit'], true)
            : $level === 'edit';
        if (! $allowed && $request->isMethod('GET') && $module === 'dashboard') {
            $fallback = ManagerAccess::firstAllowedPath($user);

            if ($fallback && $fallback !== '/dashboard') {
                return redirect($fallback);
            }
        }
        abort_unless($allowed, 403, 'You do not have permission to access this section.');

        return $next($request);
    }

    private function moduleFor(string $path): ?string
    {
        if (str_starts_with($path, 'management/manager-history')) {
            return null;
        }

        $map = [
            'dashboard' => 'dashboard',
            'team-dashboard' => 'team_dashboard',
            'lead-workflow/lead-card' => 'lead_card', 'lead-workflow/leads-shop' => 'leads_shop',
            'lead-workflow/confirm-leads' => 'confirm_leads', 'lead-workflow/dispatch-leads' => 'dispatch_leads',
            'lead-workflow/sag' => 'sag',
            'lead-workflow/reschedule' => 'reschedule', 'lead-workflow/rehash' => 'rehash',
            'lead-workflow/555' => '555', 'lead-workflow/la' => 'la', 'lead-workflow/his' => 'his',
            'lead-workflow/toss-leads' => 'toss_leads',
            'lead-workflow/keep-in-touch' => 'keep_in_touch', 'lead-workflow/data' => 'data',
            'lead-workflow/booking-board' => 'booking_board', 'lead-workflow/tele-hours' => 'tele_hours',
            'management/quality-control' => 'quality_control', 'management/projects' => 'projects',
            'management/' => 'contacts_users',
        ];
        foreach ($map as $prefix => $module) {
            if (str_starts_with($path, $prefix)) {
                return $module;
            }
        }

        return null;
    }
}
