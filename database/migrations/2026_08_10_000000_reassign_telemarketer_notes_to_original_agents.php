<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('lead_notes')
            || ! Schema::hasTable('leads')
            || ! Schema::hasTable('agents')) {
            return;
        }

        DB::table('leads')
            ->join('agents', 'agents.agent_id', '=', 'leads.agent_id')
            ->whereNotNull('agents.account_id')
            ->select(['leads.id', 'agents.account_id'])
            ->orderBy('leads.id')
            ->get()
            ->groupBy('account_id')
            ->each(function ($leads, $accountId): void {
                DB::table('lead_notes')
                    ->whereIn('lead_id', $leads->pluck('id'))
                    ->where('note_type', 'telemarketer')
                    ->where(function ($query) use ($accountId): void {
                        $query->whereNull('created_by')
                            ->orWhere('created_by', '!=', $accountId);
                    })
                    ->update(['created_by' => $accountId]);
            });
    }

    public function down(): void
    {
        // The previous note author cannot be recovered reliably.
    }
};
