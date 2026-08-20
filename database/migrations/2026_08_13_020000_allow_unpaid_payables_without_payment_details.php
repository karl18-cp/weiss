<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_accounting_transactions', function (Blueprint $table): void {
            $table->string('payment_method')->nullable()->change();
            $table->string('reference_number')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('project_accounting_transactions', function (Blueprint $table): void {
            $table->string('payment_method')->nullable(false)->change();
            $table->string('reference_number')->nullable(false)->change();
        });
    }
};
