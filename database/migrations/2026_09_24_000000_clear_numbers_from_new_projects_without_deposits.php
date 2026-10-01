<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('projects')
            ->where('status', 'new')
            ->whereNotNull('lead_id')
            ->whereNotNull('project_number')
            ->whereNotExists(function ($query): void {
                $query->selectRaw('1')
                    ->from('project_accounting_transactions')
                    ->whereColumn('project_accounting_transactions.project_id', 'projects.id')
                    ->where('project_accounting_transactions.type', 'receivable')
                    ->where('project_accounting_transactions.status', 'deposit');
            })
            ->update(['project_number' => null, 'updated_at' => now()]);
    }

    public function down(): void
    {
        // Cleared numbers must be reassigned only after a deposited receivable.
    }
};
