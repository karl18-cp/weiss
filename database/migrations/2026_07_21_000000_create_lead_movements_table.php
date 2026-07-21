<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // MySQL can leave the table behind when adding a foreign key fails.
        // This migration has not completed yet, so a partial table is safe to
        // remove before retrying.
        Schema::dropIfExists('lead_movements');

        Schema::create('lead_movements', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('lead_id')->constrained('leads')->cascadeOnDelete();
            $table->string('from_status', 50)->nullable();
            $table->string('to_status', 50);
            // The production accounts table is legacy and its acc_id column
            // does not have a consistent FK-compatible definition. Keep the
            // identifier without a database constraint, as lead_notes does.
            $table->unsignedInteger('moved_by')->nullable();
            $table->timestamps();

            $table->index(['lead_id', 'created_at']);
            $table->index('moved_by');
        });

        DB::table('leads')->orderBy('id')->each(function (object $lead): void {
            DB::table('lead_movements')->insert([
                'lead_id' => $lead->id,
                'from_status' => null,
                'to_status' => $lead->status ?: 'fresh',
                'moved_by' => $lead->created_by,
                'created_at' => $lead->created_at ?? now(),
                'updated_at' => $lead->created_at ?? now(),
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_movements');
    }
};
