<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        DB::table('managers')
            ->select('manager_id')
            ->orderBy('manager_id')
            ->each(function ($manager) use ($now): void {
                DB::table('manager_permissions')->insertOrIgnore([
                    'manager_id' => $manager->manager_id,
                    'module' => 'view_all_callbacks',
                    'access_level' => 'none',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            });
    }

    public function down(): void
    {
        DB::table('manager_permissions')
            ->where('module', 'view_all_callbacks')
            ->delete();
    }
};
