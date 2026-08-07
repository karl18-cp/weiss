<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $rows = DB::table('managers')
            ->pluck('manager_id')
            ->map(fn ($managerId): array => [
                'manager_id' => $managerId,
                'module' => 'view_all_kit_managers',
                'access_level' => 'none',
                'created_at' => $now,
                'updated_at' => $now,
            ])
            ->all();

        if ($rows !== []) {
            DB::table('manager_permissions')->insertOrIgnore($rows);
        }
    }

    public function down(): void
    {
        DB::table('manager_permissions')
            ->where('module', 'view_all_kit_managers')
            ->delete();
    }
};
