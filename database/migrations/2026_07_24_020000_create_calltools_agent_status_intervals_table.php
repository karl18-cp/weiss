<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('calltools_agent_status_intervals', function (Blueprint $table): void {
            $table->id();
            $table->string('app_user_id', 191)->collation('utf8mb4_unicode_ci');
            $table->string('status_id', 191)->collation('utf8mb4_unicode_ci');
            $table->dateTime('started_at');
            $table->dateTime('ended_at')->nullable();
            $table->timestamps();
            $table->unique(['app_user_id', 'status_id', 'started_at'], 'ct_status_interval_unique');
            $table->index(['status_id', 'started_at', 'ended_at'], 'ct_status_interval_range');
            $table->index(['app_user_id', 'ended_at'], 'ct_status_interval_open');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calltools_agent_status_intervals');
    }
};
