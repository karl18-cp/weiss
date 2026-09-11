<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_activity_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('actor_id')->nullable()->index();
            $table->string('subject_type', 80);
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('action', 30);
            $table->string('description', 500);
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->timestamps();
            $table->index(['project_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_activity_logs');
    }
};
