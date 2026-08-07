<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('agents', 'inactive_at')) {
            Schema::table('agents', function (Blueprint $table): void {
                $table->timestamp('inactive_at')->nullable()->index();
            });
        }

        // A joined UPDATE is not supported by SQLite, which is used by the
        // feature-test database. Correlated subqueries work in both SQLite
        // and MySQL and preserve the same backfill behavior.
        DB::table('agents')
            ->whereExists(function ($query): void {
                $query->selectRaw('1')
                    ->from('accounts')
                    ->whereColumn('accounts.acc_id', 'agents.account_id')
                    ->whereNotNull('accounts.suspended_at');
            })
            ->update([
                'inactive_at' => DB::raw('(SELECT suspended_at FROM accounts WHERE accounts.acc_id = agents.account_id)'),
            ]);
    }

    public function down(): void
    {
        if (Schema::hasColumn('agents', 'inactive_at')) {
            Schema::table('agents', function (Blueprint $table): void {
                $table->dropColumn('inactive_at');
            });
        }
    }
};
