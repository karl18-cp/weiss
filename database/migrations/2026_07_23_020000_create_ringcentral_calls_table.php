<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ringcentral_calls', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('lead_id')->constrained('leads')->cascadeOnDelete();
            $table->unsignedInteger('account_id')->index();
            $table->string('phone_number', 30);
            $table->string('normalized_phone', 30)->index();
            $table->string('direction', 20)->default('Outbound');
            $table->string('telephony_session_id', 191)->nullable()->unique();
            $table->string('ringcentral_call_log_id', 191)->nullable()->unique();
            $table->string('result', 100)->nullable();
            $table->unsignedInteger('duration_seconds')->default(0);
            $table->string('recording_id', 191)->nullable()->index();
            $table->string('recording_path')->nullable();
            $table->string('recording_content_type', 100)->nullable();
            $table->dateTime('initiated_at')->index();
            $table->dateTime('started_at')->nullable();
            $table->dateTime('ended_at')->nullable();
            $table->dateTime('matched_at')->nullable();
            $table->dateTime('recorded_at')->nullable();
            $table->timestamps();
            $table->index(['normalized_phone', 'initiated_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ringcentral_calls');
    }
};
