<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_documents', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('uploaded_by')->nullable();
            $table->string('category', 100)->default('Salesman Upload');
            $table->string('file_path');
            $table->string('file_name');
            $table->string('file_mime')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('drive_file_id')->nullable();
            $table->string('drive_url', 1000)->nullable();
            $table->timestamps();
            $table->index(['project_id', 'created_at']);
        });

        Schema::table('project_invoices', function (Blueprint $table): void {
            $table->foreignId('project_document_id')->nullable()->after('project_id')->constrained('project_documents')->nullOnDelete();
        });
        Schema::table('project_accounting_transactions', function (Blueprint $table): void {
            $table->unsignedBigInteger('project_document_id')->nullable()->after('project_id');
            $table->foreign('project_document_id', 'acct_tx_document_fk')->references('id')->on('project_documents')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('project_accounting_transactions', function (Blueprint $table): void {
            $table->dropForeign('acct_tx_document_fk');
            $table->dropColumn('project_document_id');
        });
        Schema::table('project_invoices', fn (Blueprint $table) => $table->dropConstrainedForeignId('project_document_id'));
        Schema::dropIfExists('project_documents');
    }
};
