<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('agents')) {
            Schema::create('agents', function (Blueprint $table): void {
                $table->increments('agent_id');
                $table->string('agent_name');
            });

            return;
        }

        Schema::table('agents', function (Blueprint $table): void {
            $table->string('agent_name')->change();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agents');
    }
};
