<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('salesmen', function (Blueprint $table): void {
            $table->timestamp('inactive_at')->nullable()->after('company_id')->index();
        });

        DB::table('salesmen')
            ->join('accounts', 'accounts.acc_id', '=', 'salesmen.account_id')
            ->whereNotNull('accounts.suspended_at')
            ->get(['salesmen.salesman_id', 'accounts.suspended_at'])
            ->each(fn (object $row) => DB::table('salesmen')
                ->where('salesman_id', $row->salesman_id)
                ->update(['inactive_at' => $row->suspended_at]));
    }

    public function down(): void
    {
        Schema::table('salesmen', function (Blueprint $table): void {
            $table->dropColumn('inactive_at');
        });
    }
};
