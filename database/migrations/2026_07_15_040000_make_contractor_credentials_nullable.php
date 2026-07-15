<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contractors', function (Blueprint $table): void {
            $table->integer('license')->nullable()->change();
            $table->date('lic_expire')->nullable()->change();
            $table->date('worker_comp')->nullable()->change();
            $table->date('insurance_expire')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('contractors', function (Blueprint $table): void {
            $table->integer('license')->nullable(false)->change();
            $table->date('lic_expire')->nullable(false)->change();
            $table->date('worker_comp')->nullable(false)->change();
            $table->date('insurance_expire')->nullable(false)->change();
        });
    }
};
