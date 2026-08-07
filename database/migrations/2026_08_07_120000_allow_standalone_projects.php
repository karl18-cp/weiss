<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->dropForeign(['lead_id']);
            $table->dropUnique(['lead_id']);
        });

        Schema::table('projects', function (Blueprint $table): void {
            $table->foreignId('lead_id')->nullable()->change();
            $table->unique('lead_id');
            $table->foreign('lead_id')->references('id')->on('leads')->cascadeOnDelete();

            $table->string('customer_name')->nullable()->after('lead_id');
            $table->string('contact_name')->nullable()->after('customer_name');
            $table->unsignedInteger('company_id')->nullable()->after('contact_name');
            $table->unsignedInteger('product_id')->nullable()->after('company_id');
            $table->unsignedInteger('telemarketer_id')->nullable()->after('product_id');
            $table->unsignedBigInteger('salesman_id')->nullable()->after('telemarketer_id');
            $table->unsignedBigInteger('manager_id')->nullable()->after('salesman_id');
            $table->string('runner')->nullable()->after('manager_id');
            $table->string('primary_number', 30)->nullable()->after('runner');
            $table->string('mobile_number', 30)->nullable()->after('primary_number');
            $table->string('email')->nullable()->after('mobile_number');
            $table->string('address')->nullable()->after('email');
            $table->string('city', 100)->nullable()->after('address');
            $table->string('state', 50)->nullable()->after('city');
            $table->string('zip_code', 15)->nullable()->after('state');
            $table->decimal('budget', 12, 2)->nullable()->after('amount');
            $table->text('manual_notes')->nullable()->after('budget');

            $table->foreign('company_id')->references('com_id')->on('companies')->nullOnDelete();
            $table->foreign('product_id')->references('prod_id')->on('products')->nullOnDelete();
            $table->foreign('telemarketer_id')->references('agent_id')->on('agents')->nullOnDelete();
            $table->foreign('salesman_id')->references('salesman_id')->on('salesmen')->nullOnDelete();
            $table->foreign('manager_id')->references('manager_id')->on('managers')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->dropForeign(['company_id']);
            $table->dropForeign(['product_id']);
            $table->dropForeign(['telemarketer_id']);
            $table->dropForeign(['salesman_id']);
            $table->dropForeign(['manager_id']);
            $table->dropForeign(['lead_id']);
            $table->dropUnique(['lead_id']);
            $table->dropColumn([
                'customer_name', 'contact_name', 'company_id', 'product_id',
                'telemarketer_id', 'salesman_id', 'manager_id', 'runner',
                'primary_number', 'mobile_number', 'email', 'address', 'city',
                'state', 'zip_code', 'budget', 'manual_notes',
            ]);
        });

        Schema::table('projects', function (Blueprint $table): void {
            $table->foreignId('lead_id')->nullable(false)->change();
            $table->unique('lead_id');
            $table->foreign('lead_id')->references('id')->on('leads')->cascadeOnDelete();
        });
    }
};
