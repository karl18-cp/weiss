<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->copyPermission('manager_permissions', 'manager_id');
        $this->copyPermission('agent_permissions', 'agent_id');
        $this->copyPermission('salesman_permissions', 'salesman_id');
    }

    public function down(): void
    {
        foreach (['manager_permissions', 'agent_permissions', 'salesman_permissions'] as $table) {
            if (Schema::hasTable($table)) {
                DB::table($table)->where('module', 'toss_leads')->delete();
            }
        }
    }

    private function copyPermission(string $table, string $ownerColumn): void
    {
        if (! Schema::hasTable($table)) {
            return;
        }

        $now = now();
        DB::table($table)
            ->where('module', 'leads_shop')
            ->get([$ownerColumn, 'access_level'])
            ->each(function ($permission) use ($table, $ownerColumn, $now): void {
                DB::table($table)->updateOrInsert(
                    [$ownerColumn => $permission->{$ownerColumn}, 'module' => 'toss_leads'],
                    [
                        'access_level' => $permission->access_level,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ],
                );
            });
    }
};
