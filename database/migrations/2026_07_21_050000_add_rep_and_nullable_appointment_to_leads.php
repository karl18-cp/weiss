<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            $table->string('rep', 100)->default('N/A')->after('agent_2_id');
            $table->dateTime('appointment_at')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            $table->dropColumn('rep');
            $table->dateTime('appointment_at')->nullable(false)->change();
        });
    }
};
