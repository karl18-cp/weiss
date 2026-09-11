<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_accounting_transactions', function (Blueprint $table): void {
            $table->unsignedBigInteger('salesman_id')->nullable()->after('vendor_id');
            $table->foreign('salesman_id', 'accounting_transactions_salesman_fk')
                ->references('salesman_id')
                ->on('salesmen')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('project_accounting_transactions', function (Blueprint $table): void {
            $table->dropForeign('accounting_transactions_salesman_fk');
            $table->dropColumn('salesman_id');
        });
    }
};
