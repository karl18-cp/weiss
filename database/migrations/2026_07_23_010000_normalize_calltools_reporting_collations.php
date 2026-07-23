<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('calltools_disposition_definitions', function (Blueprint $table): void {
            $table->string('external_id', 191)->collation('utf8mb4_unicode_ci')->change();
        });
    }

    public function down(): void
    {
        Schema::table('calltools_disposition_definitions', function (Blueprint $table): void {
            $table->string('external_id', 191)->collation('utf8mb4_general_ci')->change();
        });
    }
};
