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
        if (! $user || ! in_array($user->role, ['manager', 'agent', 'salesman'], true)) {
            return $next($request);
        }

        $permissionPath = $request->path();
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
        };
        $level = $profile?->permissions()->where('module', $module)->value('access_level') ?? 'none';
        $allowed = $request->isMethod('GET') ? in_array($level, ['view', 'edit'], true) : $level === 'edit';
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
        $map = [
            'dashboard' => 'dashboard',
            'lead-workflow/lead-card' => 'lead_card', 'lead-workflow/leads-shop' => 'leads_shop',
            'lead-workflow/confirm-leads' => 'confirm_leads', 'lead-workflow/dispatch-leads' => 'dispatch_leads',
            'lead-workflow/reschedule' => 'reschedule', 'lead-workflow/rehash' => 'rehash',
            'lead-workflow/555' => '555', 'lead-workflow/la' => 'la', 'lead-workflow/his' => 'his',
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
