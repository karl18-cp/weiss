<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('accounts', 'suspended_at')) {
            return;
        }

        Schema::table('accounts', function (Blueprint $table): void {
            $table->timestamp('suspended_at')->nullable()->after('role')->index();
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('accounts', 'suspended_at')) {
            return;
        }

        Schema::table('accounts', function (Blueprint $table): void {
            $table->dropColumn('suspended_at');
        });
    }
};
