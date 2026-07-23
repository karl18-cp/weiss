<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $tables = [
            'manager_permissions' => ['profile_table' => 'managers', 'key' => 'manager_id'],
            'agent_permissions' => ['profile_table' => 'agents', 'key' => 'agent_id'],
            'salesman_permissions' => ['profile_table' => 'salesmen', 'key' => 'salesman_id'],
        ];

        foreach ($tables as $permissionTable => $profile) {
            $rows = DB::table($profile['profile_table'])
                ->whereNotNull('account_id')
                ->pluck($profile['key'])
                ->map(fn ($id): array => [
                    $profile['key'] => $id,
                    'module' => 'dashboard',
                    'access_level' => 'edit',
                    'created_at' => $now,
                    'updated_at' => $now,
                ])
                ->all();

            if ($rows !== []) {
                DB::table($permissionTable)->insertOrIgnore($rows);
            }
        }
    }

    public function down(): void
    {
        DB::table('manager_permissions')->where('module', 'dashboard')->delete();
        DB::table('agent_permissions')->where('module', 'dashboard')->delete();
        DB::table('salesman_permissions')->where('module', 'dashboard')->delete();
    }
};
