<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_hour_exclusions', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('agent_id');
            $table->date('work_date');
            $table->unsignedBigInteger('deleted_by')->nullable();
            $table->timestamps();

            $table->foreign('agent_id')->references('agent_id')->on('agents')->cascadeOnDelete();
            $table->unique(['agent_id', 'work_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_hour_exclusions');
    }
};
