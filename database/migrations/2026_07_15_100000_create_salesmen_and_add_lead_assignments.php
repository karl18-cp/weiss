<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('salesmen', function (Blueprint $table) {
            $table->id('salesman_id');
            $table->string('salesman_name');
            $table->timestamps();
        });

        Schema::table('leads', function (Blueprint $table) {
            $table->foreignId('salesman_1_id')
                ->nullable()
                ->after('agent_id')
                ->constrained('salesmen', 'salesman_id')
                ->nullOnDelete();
            $table->foreignId('salesman_2_id')
                ->nullable()
                ->after('salesman_1_id')
                ->constrained('salesmen', 'salesman_id')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->dropConstrainedForeignId('salesman_2_id');
            $table->dropConstrainedForeignId('salesman_1_id');
        });

        Schema::dropIfExists('salesmen');
    }
};
