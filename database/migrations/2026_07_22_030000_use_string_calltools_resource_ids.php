<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agents', fn (Blueprint $table) => $table->string('calltools_user_id', 191)->nullable()->change());
        Schema::table('calltools_calls', function (Blueprint $table): void {
            $table->string('contact_id', 191)->nullable()->change();
            $table->string('app_user_id', 191)->nullable()->change();
            $table->string('campaign_id', 191)->nullable()->change();
        });
        Schema::table('calltools_dispositions', function (Blueprint $table): void {
            $table->string('contact_id', 191)->nullable()->change();
            $table->string('app_user_id', 191)->nullable()->change();
            $table->string('campaign_id', 191)->nullable()->change();
            $table->string('disposition_id', 191)->nullable()->change();
        });
        Schema::table('calltools_agent_daily_metrics', fn (Blueprint $table) => $table->string('app_user_id', 191)->change());
    }

    public function down(): void
    {
        Schema::table('agents', fn (Blueprint $table) => $table->unsignedBigInteger('calltools_user_id')->nullable()->change());
        Schema::table('calltools_calls', function (Blueprint $table): void {
            $table->unsignedBigInteger('contact_id')->nullable()->change();
            $table->unsignedBigInteger('app_user_id')->nullable()->change();
            $table->unsignedBigInteger('campaign_id')->nullable()->change();
        });
        Schema::table('calltools_dispositions', function (Blueprint $table): void {
            $table->unsignedBigInteger('contact_id')->nullable()->change();
            $table->unsignedBigInteger('app_user_id')->nullable()->change();
            $table->unsignedBigInteger('campaign_id')->nullable()->change();
            $table->unsignedBigInteger('disposition_id')->nullable()->change();
        });
        Schema::table('calltools_agent_daily_metrics', fn (Blueprint $table) => $table->unsignedBigInteger('app_user_id')->change());
    }
};
