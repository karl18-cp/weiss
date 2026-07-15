<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('accounts')) {
            return;
        }

        Schema::create('accounts', function (Blueprint $table) {
            $table->id('acc_id');
            $table->string('username')->unique();
            $table->string('password');
            $table->string('role')->default('user');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accounts');
    }
};
