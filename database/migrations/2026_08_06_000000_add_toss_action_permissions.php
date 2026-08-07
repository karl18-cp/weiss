<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        foreach ([
            'manager_permissions' => 'manager_id',
            'agent_permissions' => 'agent_id',
            'salesman_permissions' => 'salesman_id',
        ] as $table => $ownerColumn) {
            $rows = DB::table($table)
                ->select($ownerColumn)
                ->distinct()
                ->get()
                ->map(fn ($permission): array => [
                    $ownerColumn => $permission->{$ownerColumn},
                    'module' => 'toss_action',
                    'access_level' => 'none',
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
        foreach (['manager_permissions', 'agent_permissions', 'salesman_permissions'] as $table) {
            DB::table($table)->where('module', 'toss_action')->delete();
        }
    }
};
