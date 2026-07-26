<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->addPermission('manager_permissions', 'manager_id');
        $this->addPermission('agent_permissions', 'agent_id');
        $this->addPermission('salesman_permissions', 'salesman_id');
    }

    public function down(): void
    {
        foreach (['manager_permissions', 'agent_permissions', 'salesman_permissions'] as $table) {
            if (Schema::hasTable($table)) {
                DB::table($table)->where('module', 'full_phone_numbers')->delete();
            }
        }
    }

    private function addPermission(string $table, string $ownerColumn): void
    {
        if (! Schema::hasTable($table)) {
            return;
        }

        $now = now();
        DB::table($table)
            ->distinct()
            ->pluck($ownerColumn)
            ->each(fn ($ownerId) => DB::table($table)->updateOrInsert(
                [$ownerColumn => $ownerId, 'module' => 'full_phone_numbers'],
                [
                    'access_level' => 'none',
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            ));
    }
};
