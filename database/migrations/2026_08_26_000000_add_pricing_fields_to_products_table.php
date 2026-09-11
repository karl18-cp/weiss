<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('products', 'price')) {
            Schema::table('products', function (Blueprint $table): void {
                $table->decimal('price', 12, 2)->nullable()->after('product_name');
            });
        }
        if (! Schema::hasColumn('products', 'unit')) {
            Schema::table('products', function (Blueprint $table): void {
                $table->string('unit', 50)->nullable()->after('price');
            });
        }
        if (! Schema::hasColumn('products', 'description')) {
            Schema::table('products', function (Blueprint $table): void {
                $table->text('description')->nullable()->after('unit');
            });
        }
    }

    public function down(): void
    {
        $columns = array_values(array_filter(
            ['price', 'unit', 'description'],
            fn (string $column): bool => Schema::hasColumn('products', $column),
        ));

        if ($columns !== []) {
            Schema::table('products', function (Blueprint $table) use ($columns): void {
                $table->dropColumn($columns);
            });
        }
    }
};
