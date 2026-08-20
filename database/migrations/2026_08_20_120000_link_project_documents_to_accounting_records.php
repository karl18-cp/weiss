<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_documents', function (Blueprint $table): void {
            $table->foreignId('project_invoice_id')->nullable()->after('project_id');
            $table->foreignId('project_accounting_transaction_id')->nullable()->after('project_invoice_id');
            $table->foreign('project_invoice_id', 'project_docs_invoice_fk')->references('id')->on('project_invoices')->nullOnDelete();
            $table->foreign('project_accounting_transaction_id', 'project_docs_accounting_fk')->references('id')->on('project_accounting_transactions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('project_documents', function (Blueprint $table): void {
            $table->dropForeign('project_docs_invoice_fk');
            $table->dropForeign('project_docs_accounting_fk');
            $table->dropColumn(['project_invoice_id', 'project_accounting_transaction_id']);
        });
    }
};
