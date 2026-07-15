<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('manager_permissions');
        Schema::dropIfExists('managers');

        Schema::create('managers', function (Blueprint $table) {
            $table->id('manager_id');
            $table->integer('account_id')->unique();
            $table->string('manager_name');
            $table->string('phone', 30);
            $table->unsignedInteger('company_id')->nullable();
            $table->json('manager_types');
            $table->timestamps();

            $table->foreign('account_id')->references('acc_id')->on('accounts')->cascadeOnDelete();
            $table->foreign('company_id')->references('com_id')->on('companies')->nullOnDelete();
        });

        Schema::create('manager_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('manager_id')->constrained('managers', 'manager_id')->cascadeOnDelete();
            $table->string('module', 60);
            $table->string('access_level', 10)->default('none');
            $table->timestamps();
            $table->unique(['manager_id', 'module']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manager_permissions');
        Schema::dropIfExists('managers');
    }
};
