<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('contractors')) {
            return;
        }

        Schema::create('contractors', function (Blueprint $table): void {
            $table->increments('con_id');
            $table->string('contractor');
            $table->string('address');
            $table->integer('zip');
            $table->text('city');
            $table->text('state');
            $table->string('email');
            $table->integer('phone');
            $table->integer('license');
            $table->date('lic_expire');
            $table->date('worker_comp');
            $table->date('insurance_expire');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contractors');
    }
};
