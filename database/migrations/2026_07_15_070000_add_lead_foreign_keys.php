<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table): void {
            $table->unsignedInteger('com_id')->change();
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->unsignedInteger('prod_id', true)->change();
        });

        Schema::table('agents', function (Blueprint $table): void {
            $table->unsignedInteger('agent_id', true)->change();
        });

        Schema::table('leads', function (Blueprint $table): void {
            $table->foreign('company_id', 'leads_company_fk')
                ->references('com_id')
                ->on('companies')
                ->cascadeOnUpdate()
                ->restrictOnDelete();
            $table->foreign('product_id', 'leads_product_fk')
                ->references('prod_id')
                ->on('products')
                ->cascadeOnUpdate()
                ->restrictOnDelete();
            $table->foreign('agent_id', 'leads_agent_fk')
                ->references('agent_id')
                ->on('agents')
                ->cascadeOnUpdate()
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            $table->dropForeign('leads_company_fk');
            $table->dropForeign('leads_product_fk');
            $table->dropForeign('leads_agent_fk');
        });
    }
};
