<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_accounting_transactions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type');
            $table->string('category');
            $table->date('transaction_date');
            $table->string('payment_method');
            $table->string('reference_number');
            $table->string('counterparty')->nullable();
            $table->decimal('amount', 12, 2);
            $table->string('status')->default('pending');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['project_id', 'type', 'transaction_date'], 'project_accounting_lookup_index');
        });

        Schema::create('accounting_transaction_scheduled_payment', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('project_accounting_transaction_id');
            $table->unsignedBigInteger('scheduled_payment_id');
            $table->foreign('project_accounting_transaction_id', 'accounting_schedule_transaction_fk')
                ->references('id')
                ->on('project_accounting_transactions')
                ->cascadeOnDelete();
            $table->foreign('scheduled_payment_id', 'accounting_schedule_payment_fk')
                ->references('id')
                ->on('scheduled_payments')
                ->cascadeOnDelete();
            $table->unique(
                ['project_accounting_transaction_id', 'scheduled_payment_id'],
                'accounting_transaction_schedule_unique',
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounting_transaction_scheduled_payment');
        Schema::dropIfExists('project_accounting_transactions');
    }
};
