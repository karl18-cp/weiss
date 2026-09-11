<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccountIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->suspended_at) {
            Auth::guard()->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return to_route('login')->withErrors([
                'username' => 'Your account is suspended. Please contact an administrator.',
            ]);
        }

        // A salesman may close the installed portal, remove it from recent
        // apps, or leave it suspended longer than the normal session lifetime.
        // Ensure the authenticated browser also has Laravel's long-lived
        // remember cookie so reopening the portal restores the account instead
        // of sending the salesman back to the login screen.
        if (
            $request->user()?->role === 'salesman'
            && $request->is('salesman', 'salesman/*')
            && ! $request->cookie(Auth::guard()->getRecallerName())
        ) {
            Auth::guard()->login($request->user(), true);
        }

        return $next($request);
    }
}
