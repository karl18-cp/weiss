<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ringcentral_calls', function (Blueprint $table): void {
            $table->dateTime('sync_checked_at')->nullable()->index()->after('matched_at');
        });
    }

    public function down(): void
    {
        Schema::table('ringcentral_calls', function (Blueprint $table): void {
            $table->dropIndex(['sync_checked_at']);
            $table->dropColumn('sync_checked_at');
        });
    }
};
