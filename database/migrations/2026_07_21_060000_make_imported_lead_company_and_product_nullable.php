<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            $table->unsignedInteger('company_id')->nullable()->change();
            $table->unsignedInteger('product_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            $table->unsignedInteger('company_id')->nullable(false)->change();
            $table->unsignedInteger('product_id')->nullable(false)->change();
        });
    }
};
