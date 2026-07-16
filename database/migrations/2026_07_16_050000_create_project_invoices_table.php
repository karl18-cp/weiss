<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_invoices', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            // The contractor directory uses its legacy signed INT primary key.
            $table->integer('contractor_id');
            $table->string('invoice_number');
            $table->date('invoice_date');
            $table->decimal('amount', 12, 2);
            $table->text('notes')->nullable();
            $table->string('status')->default('pending');
            $table->string('file_path')->nullable();
            $table->string('file_name')->nullable();
            $table->string('file_mime')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->timestamps();

            $table->foreign('contractor_id')->references('con_id')->on('contractors')->restrictOnDelete();
            $table->unique(['project_id', 'invoice_number']);
            $table->index(['project_id', 'invoice_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_invoices');
    }
};
