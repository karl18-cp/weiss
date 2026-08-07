<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            $table->unsignedBigInteger('manager_2_id')->nullable()->after('agent_2_id');
            $table->foreign('manager_2_id')->references('manager_id')->on('managers')->nullOnDelete();
        });

        $latestManagerMoves = DB::table('lead_movements as movement')
            ->join('managers as manager', 'manager.account_id', '=', 'movement.moved_by')
            ->whereIn('movement.from_status', ['fresh', 'raw', 'cb', 'naov'])
            ->whereIn('movement.to_status', ['confirmed', 'dispatched'])
            ->orderByDesc('movement.id')
            ->get(['movement.lead_id', 'manager.manager_id'])
            ->unique('lead_id');

        foreach ($latestManagerMoves as $move) {
            DB::table('leads')
                ->where('id', $move->lead_id)
                ->whereNull('manager_2_id')
                ->update(['manager_2_id' => $move->manager_id]);
        }
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            $table->dropForeign(['manager_2_id']);
            $table->dropColumn('manager_2_id');
        });
    }
};
