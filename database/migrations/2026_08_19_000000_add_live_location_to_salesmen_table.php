<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('salesmen', function (Blueprint $table): void {
            $table->decimal('live_latitude', 10, 7)->nullable()->after('phone');
            $table->decimal('live_longitude', 10, 7)->nullable()->after('live_latitude');
            $table->unsignedInteger('live_location_accuracy')->nullable()->after('live_longitude');
            $table->timestamp('live_location_updated_at')->nullable()->after('live_location_accuracy');
        });
    }

    public function down(): void
    {
        Schema::table('salesmen', function (Blueprint $table): void {
            $table->dropColumn(['live_latitude', 'live_longitude', 'live_location_accuracy', 'live_location_updated_at']);
        });
    }
};
