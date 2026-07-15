<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lead_notes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('lead_id')->constrained('leads')->cascadeOnDelete();
            $table->string('note_type', 100)->index();
            $table->text('body');
            $table->unsignedInteger('created_by');
            $table->timestamps();
            $table->index(['lead_id', 'note_type', 'created_at']);
        });

        $now = now();
        DB::table('leads')
            ->whereNotNull('telemarketer_notes')
            ->where('telemarketer_notes', '!=', '')
            ->orderBy('id')
            ->each(function (object $lead) use ($now): void {
                DB::table('lead_notes')->insert([
                    'lead_id' => $lead->id,
                    'note_type' => 'telemarketer',
                    'body' => $lead->telemarketer_notes,
                    'created_by' => $lead->created_by,
                    'created_at' => $lead->created_at ?? $now,
                    'updated_at' => $lead->updated_at ?? $now,
                ]);
            });

        DB::table('leads')
            ->whereNotNull('confirmation_notes')
            ->where('confirmation_notes', '!=', '')
            ->orderBy('id')
            ->each(function (object $lead) use ($now): void {
                DB::table('lead_notes')->insert([
                    'lead_id' => $lead->id,
                    'note_type' => 'confirmation',
                    'body' => $lead->confirmation_notes,
                    'created_by' => $lead->created_by,
                    'created_at' => $lead->created_at ?? $now,
                    'updated_at' => $lead->updated_at ?? $now,
                ]);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_notes');
    }
};
