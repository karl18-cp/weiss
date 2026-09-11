<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('salesmen', function (Blueprint $table): void {
            $table->decimal('shared_sale_commission_percent', 5, 2)
                ->default(0)
                ->after('sale_commission_percent');
        });
    }

    public function down(): void
    {
        Schema::table('salesmen', function (Blueprint $table): void {
            $table->dropColumn('shared_sale_commission_percent');
        });
    }
};
