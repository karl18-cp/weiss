<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agents', function (Blueprint $table): void {
            $table->unsignedBigInteger('calltools_user_id')->nullable()->unique()->after('account_id');
        });

        Schema::create('calltools_calls', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('calltools_id')->unique();
            $table->uuid('uuid')->unique();
            $table->unsignedBigInteger('contact_id')->nullable()->index();
            $table->unsignedBigInteger('app_user_id')->nullable()->index();
            $table->unsignedBigInteger('campaign_id')->nullable()->index();
            $table->string('system_disposition', 100)->nullable()->index();
            $table->string('call_disposition', 100)->nullable()->index();
            $table->string('destination', 40)->nullable();
            $table->string('source', 40)->nullable();
            $table->boolean('inbound')->default(false)->index();
            $table->dateTime('started_at')->nullable()->index();
            $table->dateTime('ended_at')->nullable();
            $table->string('call_type', 50)->nullable();
            $table->unsignedInteger('duration')->default(0);
            $table->unsignedInteger('billable_seconds')->default(0);
            $table->string('transferred_to', 100)->nullable();
            $table->unsignedBigInteger('recording_id')->nullable();
            $table->dateTime('calltools_created_at')->nullable()->index();
            $table->timestamps();
            $table->index(['app_user_id', 'started_at']);
        });

        Schema::create('calltools_dispositions', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('calltools_id')->unique();
            $table->uuid('call_uuid')->nullable()->index();
            $table->unsignedBigInteger('contact_id')->nullable()->index();
            $table->unsignedBigInteger('app_user_id')->nullable()->index();
            $table->unsignedBigInteger('campaign_id')->nullable()->index();
            $table->unsignedBigInteger('disposition_id')->nullable();
            $table->string('phone_number', 40)->nullable();
            $table->dateTime('calltools_created_at')->nullable()->index();
            $table->timestamps();
            $table->index(['app_user_id', 'calltools_created_at']);
        });

        Schema::create('calltools_agent_daily_metrics', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('app_user_id');
            $table->date('metric_date');
            $table->string('full_name')->nullable();
            $table->string('status', 100)->nullable();
            $table->boolean('ready')->default(false);
            $table->boolean('logged_in')->default(false);
            $table->unsignedInteger('active_seconds')->default(0);
            $table->unsignedInteger('available_seconds')->default(0);
            $table->unsignedInteger('calls')->default(0);
            $table->unsignedInteger('calls_outbound')->default(0);
            $table->unsignedInteger('calls_outbound_connected')->default(0);
            $table->unsignedInteger('calls_inbound')->default(0);
            $table->unsignedInteger('transfers')->default(0);
            $table->decimal('average_post_call_seconds', 10, 2)->default(0);
            $table->dateTime('logged_in_since')->nullable();
            $table->dateTime('status_modified_at')->nullable();
            $table->dateTime('captured_at');
            $table->timestamps();
            $table->unique(['app_user_id', 'metric_date']);
            $table->index(['metric_date', 'app_user_id']);
        });

        Schema::create('calltools_sync_states', function (Blueprint $table): void {
            $table->string('key')->primary();
            $table->text('value')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calltools_sync_states');
        Schema::dropIfExists('calltools_agent_daily_metrics');
        Schema::dropIfExists('calltools_dispositions');
        Schema::dropIfExists('calltools_calls');
        Schema::table('agents', function (Blueprint $table): void {
            $table->dropUnique(['calltools_user_id']);
            $table->dropColumn('calltools_user_id');
        });
    }
};
