<?php

namespace App\Support;

use App\Models\Account;

class PhoneNumberVisibility
{
    public static function canView(?Account $user = null): bool
    {
        $user ??= auth()->user();

        if (! $user) {
            return false;
        }

        if ($user->role === 'admin') {
            return true;
        }

        $profile = match ($user->role) {
            'manager' => $user->manager,
            'agent' => $user->agent,
            'salesman' => $user->salesman,
            default => null,
        };

        return in_array(
            $profile?->permissions()
                ->where('module', 'full_phone_numbers')
                ->value('access_level') ?? 'none',
            ['view', 'edit'],
            true,
        );
    }

    public static function mask(?string $number): ?string
    {
        if (! $number) {
            return $number;
        }

        $digits = preg_replace('/\D+/', '', $number) ?: '';
        $visible = substr($digits, 0, 4);

        return $visible.str_repeat('*', max(6, strlen($digits) - strlen($visible)));
    }
}
