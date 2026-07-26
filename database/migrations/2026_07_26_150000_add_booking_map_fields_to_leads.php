<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            $table->decimal('latitude', 10, 7)->nullable()->after('state');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            $table->string('geocoding_status', 20)->nullable()->after('longitude');
            $table->timestamp('geocoded_at')->nullable()->after('geocoding_status');
            $table->unsignedSmallInteger('appointment_duration_minutes')
                ->default(60)
                ->after('appointment_at');
            $table->index(['geocoding_status', 'updated_at']);
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            $table->dropIndex(['geocoding_status', 'updated_at']);
            $table->dropColumn([
                'latitude',
                'longitude',
                'geocoding_status',
                'geocoded_at',
                'appointment_duration_minutes',
            ]);
        });
    }
};
