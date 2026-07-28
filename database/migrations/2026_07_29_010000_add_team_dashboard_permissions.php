<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $tables = [
            'manager_permissions' => 'manager_id',
            'agent_permissions' => 'agent_id',
            'salesman_permissions' => 'salesman_id',
        ];

        foreach ($tables as $table => $key) {
            $rows = DB::table($table)
                ->where('module', 'dashboard')
                ->get([$key, 'access_level'])
                ->map(fn ($permission): array => [
                    $key => $permission->{$key},
                    'module' => 'team_dashboard',
                    'access_level' => $permission->access_level,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])
                ->all();

            if ($rows !== []) {
                DB::table($table)->insertOrIgnore($rows);
            }
        }
    }

    public function down(): void
    {
        DB::table('manager_permissions')->where('module', 'team_dashboard')->delete();
        DB::table('agent_permissions')->where('module', 'team_dashboard')->delete();
        DB::table('salesman_permissions')->where('module', 'team_dashboard')->delete();
    }
};
