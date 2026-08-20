<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agent_manual_hours', function (Blueprint $table): void {
            $table->dateTime('calltools_first_login_at')->nullable()->after('work_date');
            $table->dateTime('calltools_last_logout_at')->nullable()->after('calltools_first_login_at');
            $table->unsignedInteger('imported_seconds_override')->nullable()->after('duration_seconds');
            $table->unsignedInteger('leads_sent_override')->nullable()->after('imported_seconds_override');
        });
    }

    public function down(): void
    {
        Schema::table('agent_manual_hours', function (Blueprint $table): void {
            $table->dropColumn([
                'calltools_first_login_at',
                'calltools_last_logout_at',
                'imported_seconds_override',
                'leads_sent_override',
            ]);
        });
    }
};
