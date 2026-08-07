<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $firstManagerMoves = DB::table('lead_movements as movement')
            ->join('managers as manager', 'manager.account_id', '=', 'movement.moved_by')
            ->whereIn('movement.to_status', ['confirmed', 'dispatched'])
            ->orderBy('movement.id')
            ->get(['movement.lead_id', 'manager.manager_id'])
            ->unique('lead_id');

        foreach ($firstManagerMoves as $move) {
            DB::table('leads')
                ->where('id', $move->lead_id)
                ->whereNull('manager_2_id')
                ->update(['manager_2_id' => $move->manager_id]);
        }
    }

    public function down(): void
    {
        // Historical ownership is intentionally retained if this migration is rolled back.
    }
};
