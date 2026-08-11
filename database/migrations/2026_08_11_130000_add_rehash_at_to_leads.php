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
            $table->dateTime('rehash_at')->nullable()->after('created_at')->index();
        });

        $sourceStatuses = [
            '555', 'reschedule', 'rehash', 'rehash_ng', 'rehash_toss',
            'rehash_cb', 'la', 'his', 'project',
        ];

        DB::table('lead_movements')
            ->where('to_status', 'fresh')
            ->whereIn('from_status', $sourceStatuses)
            ->orderBy('created_at')
            ->orderBy('id')
            ->get(['lead_id', 'created_at'])
            ->each(fn ($movement) => DB::table('leads')
                ->where('id', $movement->lead_id)
                ->update(['rehash_at' => $movement->created_at]));

        // Some SAG leads were returned after a project cancellation changed
        // their lead status back to Dispatch. Their movement therefore says
        // dispatched -> fresh even though the action originated in SAG.
        DB::table('lead_movements')
            ->join('projects', 'projects.lead_id', '=', 'lead_movements.lead_id')
            ->where('lead_movements.to_status', 'fresh')
            ->whereIn('projects.status', ['completed', 'canceled'])
            ->orderBy('lead_movements.created_at')
            ->orderBy('lead_movements.id')
            ->get(['lead_movements.lead_id', 'lead_movements.created_at'])
            ->each(fn ($movement) => DB::table('leads')
                ->where('id', $movement->lead_id)
                ->update(['rehash_at' => $movement->created_at]));
    }

    public function down(): void
    {
        Schema::table('leads', fn (Blueprint $table) => $table->dropColumn('rehash_at'));
    }
};
