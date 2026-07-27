<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('push_subscriptions', function (Blueprint $table): void {
            $table->id();
            // Production uses a legacy accounts table whose acc_id type differs
            // across hosts, so keep this indexed instead of adding a foreign key.
            $table->unsignedBigInteger('account_id')->index();
            $table->text('endpoint')->unique();
            $table->text('public_key');
            $table->text('auth_token');
            $table->string('content_encoding', 32)->default('aes128gcm');
            $table->timestamps();

        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_subscriptions');
    }
};
