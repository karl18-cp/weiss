<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // MySQL can leave the empty table behind when adding a foreign key fails.
        Schema::dropIfExists('agent_manual_hours');

        Schema::create('agent_manual_hours', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('agent_id');
            $table->date('work_date');
            $table->unsignedInteger('duration_seconds');
            $table->string('note', 500)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->foreign('agent_id')->references('agent_id')->on('agents')->cascadeOnDelete();
            $table->unique(['agent_id', 'work_date']);
            $table->index('work_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_manual_hours');
    }
};
