<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('push_notification_logs', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('lead_id')->index();
            $table->unsignedBigInteger('account_id')->index();
            $table->string('notification_type', 32);
            $table->dateTime('appointment_at');
            $table->timestamp('sent_at');
            $table->unique(
                ['lead_id', 'account_id', 'notification_type', 'appointment_at'],
                'push_reminder_unique',
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_notification_logs');
    }
};
