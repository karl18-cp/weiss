<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            if (! Schema::hasColumn('leads', 'status')) {
                $table->string('status', 50)->default('fresh')->after('created_by');
            }
            if (! Schema::hasColumn('leads', 'confirmation_notes')) {
                $table->text('confirmation_notes')->nullable()->after('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            $table->dropColumn(['status', 'confirmation_notes']);
        });
    }
};
