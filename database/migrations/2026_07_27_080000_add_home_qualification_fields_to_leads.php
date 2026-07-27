<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            $table->unsignedSmallInteger('house_age')->nullable()->after('years_in_house');
            $table->boolean('needs_financing')->nullable()->after('house_age');
            $table->decimal('house_value', 14, 2)->nullable()->after('needs_financing');
            $table->timestamp('crm_qualification_completed_at')->nullable()->after('house_value');
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            $table->dropColumn([
                'house_age',
                'needs_financing',
                'house_value',
                'crm_qualification_completed_at',
            ]);
        });
    }
};
