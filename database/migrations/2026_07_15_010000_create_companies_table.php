<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('companies')) {
            return;
        }

        Schema::create('companies', function (Blueprint $table) {
            $table->unsignedInteger('com_id')->primary();
            $table->string('company');
            $table->string('address');
            $table->text('prefix');
            $table->string('project_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('companies');
    }
};
