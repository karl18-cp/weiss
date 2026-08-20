<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_documents', function (Blueprint $table): void {
            $table->foreignId('project_sale_id')->nullable()->after('project_accounting_transaction_id');
            $table->foreign('project_sale_id', 'project_docs_sale_fk')->references('id')->on('project_sales')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('project_documents', function (Blueprint $table): void {
            $table->dropForeign('project_docs_sale_fk');
            $table->dropColumn('project_sale_id');
        });
    }
};
