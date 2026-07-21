<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lead_agent_assignments', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('lead_id');
            $table->unsignedInteger('agent_id');
            $table->unsignedInteger('assigned_by')->nullable();
            $table->boolean('is_original')->default(false);
            $table->timestamps();
            $table->index(['lead_id', 'created_at']);
            $table->index(['agent_id', 'lead_id']);
        });

        DB::table('leads')->orderBy('id')->each(function (object $lead): void {
            DB::table('lead_agent_assignments')->insert([
                'lead_id' => $lead->id,
                'agent_id' => $lead->agent_id,
                'assigned_by' => $lead->created_by,
                'is_original' => true,
                'created_at' => $lead->created_at ?? now(),
                'updated_at' => $lead->created_at ?? now(),
            ]);

            if ($lead->agent_2_id && (int) $lead->agent_2_id !== (int) $lead->agent_id) {
                DB::table('lead_agent_assignments')->insert([
                    'lead_id' => $lead->id,
                    'agent_id' => $lead->agent_2_id,
                    'assigned_by' => $lead->created_by,
                    'is_original' => false,
                    'created_at' => $lead->updated_at ?? now(),
                    'updated_at' => $lead->updated_at ?? now(),
                ]);
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_agent_assignments');
    }
};
