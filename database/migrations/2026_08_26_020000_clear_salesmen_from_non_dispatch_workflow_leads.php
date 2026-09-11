<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('leads')
            ->whereNotIn('status', ['dispatched', 'project'])
            ->where(function ($query): void {
                $query->whereNotNull('salesman_1_id')
                    ->orWhereNotNull('salesman_2_id');
            })
            ->update([
                'salesman_1_id' => null,
                'salesman_2_id' => null,
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        // Previous assignments cannot be reconstructed safely.
    }
};
