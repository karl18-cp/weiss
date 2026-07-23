<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agents', fn (Blueprint $table) => $table->string('calltools_user_id', 191)->nullable()->collation('utf8mb4_unicode_ci')->change());
        Schema::table('calltools_calls', function (Blueprint $table): void {
            $table->string('contact_id', 191)->nullable()->collation('utf8mb4_unicode_ci')->change();
            $table->string('app_user_id', 191)->nullable()->collation('utf8mb4_unicode_ci')->change();
            $table->string('campaign_id', 191)->nullable()->collation('utf8mb4_unicode_ci')->change();
        });
        Schema::table('calltools_dispositions', function (Blueprint $table): void {
            $table->string('contact_id', 191)->nullable()->collation('utf8mb4_unicode_ci')->change();
            $table->string('app_user_id', 191)->nullable()->collation('utf8mb4_unicode_ci')->change();
            $table->string('campaign_id', 191)->nullable()->collation('utf8mb4_unicode_ci')->change();
            $table->string('disposition_id', 191)->nullable()->collation('utf8mb4_unicode_ci')->change();
        });
        Schema::table('calltools_agent_daily_metrics', fn (Blueprint $table) => $table->string('app_user_id', 191)->collation('utf8mb4_unicode_ci')->change());
    }

    public function down(): void
    {
        // Collation normalization is intentionally retained on rollback.
    }
};
