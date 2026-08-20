<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_schedules', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('agent_id');
            $table->unsignedTinyInteger('weekday');
            $table->boolean('is_working')->default(false);
            $table->time('shift_start')->nullable();
            $table->time('shift_end')->nullable();
            $table->time('lunch_start')->nullable();
            $table->time('lunch_end')->nullable();
            $table->timestamps();
            $table->foreign('agent_id')->references('agent_id')->on('agents')->cascadeOnDelete();
            $table->unique(['agent_id', 'weekday']);
        });

        Schema::table('agent_attendance_sessions', function (Blueprint $table): void {
            $table->date('work_date')->nullable()->after('agent_id')->index();
            $table->timestamp('actual_clocked_in_at')->nullable()->after('clocked_in_at');
            $table->timestamp('lunch_out_at')->nullable()->after('actual_clocked_in_at');
            $table->timestamp('actual_lunch_out_at')->nullable()->after('lunch_out_at');
            $table->timestamp('lunch_in_at')->nullable()->after('actual_lunch_out_at');
            $table->timestamp('actual_lunch_in_at')->nullable()->after('lunch_in_at');
            $table->timestamp('actual_clocked_out_at')->nullable()->after('clocked_out_at');
        });
    }

    public function down(): void
    {
        Schema::table('agent_attendance_sessions', function (Blueprint $table): void {
            $table->dropColumn(['work_date', 'actual_clocked_in_at', 'lunch_out_at', 'actual_lunch_out_at', 'lunch_in_at', 'actual_lunch_in_at', 'actual_clocked_out_at']);
        });
        Schema::dropIfExists('agent_schedules');
    }
};
