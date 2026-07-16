<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scheduled_payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->date('expected_date');
            $table->string('payment_stage');
            $table->decimal('amount', 12, 2);
            $table->boolean('qb')->default(false);
            $table->boolean('printed_sent')->default(false);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['project_id', 'expected_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scheduled_payments');
    }
};
