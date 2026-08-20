<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contractors', function (Blueprint $table): void {
            $table->string('point_of_contact')->nullable()->after('contractor');
        });
    }

    public function down(): void
    {
        Schema::table('contractors', function (Blueprint $table): void {
            $table->dropColumn('point_of_contact');
        });
    }
};
