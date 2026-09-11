<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('project_sales', 'salesman_id')) {
            Schema::table('project_sales', function (Blueprint $table): void {
                $table->unsignedBigInteger('salesman_id')->nullable()->after('product_id');
            });
        } else {
            // A failed earlier deployment may have added the column before its
            // foreign key was created. Normalize its type before retrying.
            Schema::table('project_sales', function (Blueprint $table): void {
                $table->unsignedBigInteger('salesman_id')->nullable()->change();
            });
        }

        Schema::table('project_sales', function (Blueprint $table): void {
            $table->foreign('salesman_id', 'project_sales_salesman_fk')
                ->references('salesman_id')
                ->on('salesmen')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('project_sales', function (Blueprint $table): void {
            $table->dropForeign('project_sales_salesman_fk');
            $table->dropColumn('salesman_id');
        });
    }
};
