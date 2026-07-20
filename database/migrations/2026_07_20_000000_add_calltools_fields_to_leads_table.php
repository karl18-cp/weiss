<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            $table->string('calltools_contact_id', 100)->nullable()->unique()->after('id');
            $table->string('calltools_campaign_name')->nullable()->after('source');
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            $table->dropUnique(['calltools_contact_id']);
            $table->dropColumn(['calltools_contact_id', 'calltools_campaign_name']);
        });
    }
};
