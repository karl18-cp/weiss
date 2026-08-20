<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('salesmen', function (Blueprint $table): void {
            $table->decimal('initial_sale_cut_percent', 5, 2)->default(0)->after('phone');
            $table->decimal('change_order_cut_percent', 5, 2)->default(0)->after('initial_sale_cut_percent');
            $table->decimal('sale_commission_percent', 5, 2)->default(0)->after('change_order_cut_percent');
        });
    }

    public function down(): void
    {
        Schema::table('salesmen', function (Blueprint $table): void {
            $table->dropColumn(['initial_sale_cut_percent', 'change_order_cut_percent', 'sale_commission_percent']);
        });
    }
};
