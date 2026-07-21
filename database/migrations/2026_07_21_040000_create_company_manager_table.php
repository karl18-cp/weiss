<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_manager', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('manager_id');
            $table->unsignedInteger('company_id');
            $table->timestamps();
            $table->unique(['manager_id', 'company_id']);
            $table->index(['company_id', 'manager_id']);
        });

        DB::table('managers')->whereNotNull('company_id')->orderBy('manager_id')->each(
            fn (object $manager) => DB::table('company_manager')->insertOrIgnore([
                'manager_id' => $manager->manager_id,
                'company_id' => $manager->company_id,
                'created_at' => now(),
                'updated_at' => now(),
            ]),
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('company_manager');
    }
};
