<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_contractor_assignments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->integer('contractor_id');
            $table->unsignedTinyInteger('position');
            $table->timestamps();

            $table->foreign('contractor_id')->references('con_id')->on('contractors')->restrictOnDelete();
            $table->unique(['project_id', 'contractor_id']);
            $table->unique(['project_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_contractor_assignments');
    }
};
