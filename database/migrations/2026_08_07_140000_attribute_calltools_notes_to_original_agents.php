<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('lead_notes') || ! Schema::hasTable('agents')) {
            return;
        }

        DB::table('leads')
            ->join('agents', 'agents.agent_id', '=', 'leads.agent_id')
            ->where('leads.source', 'CallTools')
            ->whereNotNull('agents.account_id')
            ->select(['leads.id', 'agents.account_id'])
            ->orderBy('leads.id')
            ->get()
            ->each(function (object $lead): void {
                DB::table('lead_notes')
                    ->where('lead_id', $lead->id)
                    ->where('note_type', 'telemarketer')
                    ->update(['created_by' => $lead->account_id]);
            });
    }

    public function down(): void
    {
        // The previous note author cannot be recovered reliably.
    }
};
