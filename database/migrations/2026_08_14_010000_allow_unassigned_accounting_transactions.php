<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_accounting_transactions', function (Blueprint $table): void {
            $table->foreignId('project_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Existing unassigned records make restoring NOT NULL unsafe.
    }
};
