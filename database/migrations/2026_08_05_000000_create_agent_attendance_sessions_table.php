<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_attendance_sessions', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('agent_id');
            $table->timestamp('clocked_in_at');
            $table->timestamp('clocked_out_at')->nullable();
            $table->timestamps();

            $table->foreign('agent_id')->references('agent_id')->on('agents')->cascadeOnDelete();
            $table->index(['agent_id', 'clocked_in_at']);
            $table->index(['agent_id', 'clocked_out_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_attendance_sessions');
    }
};
