<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('project_accounting_transactions')
            ->where('type', 'receivable')
            ->whereIn('status', ['ok_to_pay', 'paid'])
            ->update(['status' => 'deposit']);
    }

    public function down(): void
    {
        DB::table('project_accounting_transactions')
            ->where('type', 'receivable')
            ->where('status', 'deposit')
            ->update(['status' => 'paid']);
    }
};
