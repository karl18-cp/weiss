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
            $calltoolsId = $table->string('calltools_id', 191);
            $appUserId = $table->string('app_user_id', 191);
            if (Schema::getConnection()->getDriverName() === 'mysql') {
                $calltoolsId->collation('utf8mb4_unicode_ci');
                $appUserId->collation('utf8mb4_unicode_ci');
            }
            $calltoolsId->unique();
            $appUserId->index();
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
