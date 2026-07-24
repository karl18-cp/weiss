<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agent_manual_hours', function (Blueprint $table): void {
            $table->unsignedInteger('lunch_seconds')->default(0)->after('duration_seconds');
        });
    }

    public function down(): void
    {
        Schema::table('agent_manual_hours', function (Blueprint $table): void {
            $table->dropColumn('lunch_seconds');
        });
    }
};
