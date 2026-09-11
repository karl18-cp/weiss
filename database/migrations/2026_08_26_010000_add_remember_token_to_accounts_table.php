<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('accounts', 'remember_token')) {
            Schema::table('accounts', function (Blueprint $table): void {
                $table->rememberToken();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('accounts', 'remember_token')) {
            Schema::table('accounts', function (Blueprint $table): void {
                $table->dropRememberToken();
            });
        }
    }
};
