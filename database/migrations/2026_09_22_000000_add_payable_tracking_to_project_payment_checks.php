<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_payment_checks', function (Blueprint $table): void {
            $table->date('transaction_date')->nullable()->after('amount');
            $table->string('payment_method')->nullable()->after('transaction_date');
            $table->string('pay_to')->nullable()->after('check_number');
            $table->string('requested_by')->nullable()->after('pay_to');
            $table->text('notes')->nullable()->after('requested_by');
        });

        Schema::table('project_accounting_transactions', function (Blueprint $table): void {
            $table->boolean('exclude_from_totals')->default(false)->after('qb')->index();
        });
    }

    public function down(): void
    {
        Schema::table('project_accounting_transactions', fn (Blueprint $table) => $table->dropColumn('exclude_from_totals'));
        Schema::table('project_payment_checks', fn (Blueprint $table) => $table->dropColumn([
            'transaction_date', 'payment_method', 'pay_to', 'requested_by', 'notes',
        ]));
    }
};
