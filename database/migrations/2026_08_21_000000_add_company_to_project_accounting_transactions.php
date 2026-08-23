<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('project_accounting_transactions', 'company_id')) {
            Schema::table('project_accounting_transactions', function (Blueprint $table): void {
                $table->unsignedInteger('company_id')->nullable()->after('project_id');
            });
        }

        Schema::table('project_accounting_transactions', function (Blueprint $table): void {
            $table->index('company_id', 'accounting_transactions_company_index');
        });
    }

    public function down(): void
    {
        Schema::table('project_accounting_transactions', function (Blueprint $table): void {
            $table->dropIndex('accounting_transactions_company_index');
            $table->dropColumn('company_id');
        });
    }
};
