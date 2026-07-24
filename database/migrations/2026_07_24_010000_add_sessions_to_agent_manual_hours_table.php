<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agent_manual_hours', function (Blueprint $table): void {
            $table->time('first_login')->nullable()->after('work_date');
            $table->time('first_logout')->nullable()->after('first_login');
            $table->time('second_login')->nullable()->after('first_logout');
            $table->time('second_logout')->nullable()->after('second_login');
        });
    }

    public function down(): void
    {
        Schema::table('agent_manual_hours', function (Blueprint $table): void {
            $table->dropColumn(['first_login', 'first_logout', 'second_login', 'second_logout']);
        });
    }
};
