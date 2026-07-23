<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('calltools_user_login_shifts', function (Blueprint $table): void {
            $table->id();
            $table->string('calltools_id', 191)->collation('utf8mb4_unicode_ci')->unique();
            $table->string('app_user_id', 191)->collation('utf8mb4_unicode_ci')->index();
            $table->dateTime('started_at')->index();
            $table->dateTime('stopped_at')->nullable()->index();
            $table->unsignedInteger('duration_seconds')->default(0);
            $table->dateTime('calltools_created_at')->nullable()->index();
            $table->timestamps();
            $table->index(['app_user_id', 'started_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calltools_user_login_shifts');
    }
};
