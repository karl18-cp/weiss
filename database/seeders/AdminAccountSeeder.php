<?php

namespace Database\Seeders;

use App\Models\Account;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminAccountSeeder extends Seeder
{
    public function run(): void
    {
        $username = env('ADMIN_USERNAME', 'admin@weiss.com');
        $password = env('ADMIN_PASSWORD');

        if (! is_string($password) || $password === '') {
            $this->command?->warn('Admin account was not seeded because ADMIN_PASSWORD is not configured.');

            return;
        }

        Account::query()
            ->where('username', 'adimn@weiss.com')
            ->delete();

        Account::query()->updateOrCreate(
            ['username' => $username],
            [
                'password' => Hash::make($password),
                'role' => 'admin',
            ],
        );
    }
}
