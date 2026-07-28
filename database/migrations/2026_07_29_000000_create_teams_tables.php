<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('teams', function (Blueprint $table): void {
            $table->id('team_id');
            $table->string('team_name');
            $table->foreignId('manager_id')
                ->constrained('managers', 'manager_id')
                ->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['team_name', 'manager_id']);
        });

        Schema::create('agent_team', function (Blueprint $table): void {
            $table->foreignId('team_id')
                ->constrained('teams', 'team_id')
                ->cascadeOnDelete();
            $table->unsignedInteger('agent_id');
            $table->timestamps();

            $table->foreign('agent_id')
                ->references('agent_id')
                ->on('agents')
                ->cascadeOnDelete();
            $table->primary(['team_id', 'agent_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_team');
        Schema::dropIfExists('teams');
    }
};
