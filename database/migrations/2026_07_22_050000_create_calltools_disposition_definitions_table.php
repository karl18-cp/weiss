<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('calltools_disposition_definitions', function (Blueprint $table): void {
            $table->id();
            $table->string('external_id', 191)->collation('utf8mb4_unicode_ci')->unique();
            $table->string('name');
            $table->string('button_color', 30)->nullable();
            $table->string('text_color', 30)->nullable();
            $table->boolean('hang_up_call')->default(false);
            $table->boolean('no_contact')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calltools_disposition_definitions');
    }
};
