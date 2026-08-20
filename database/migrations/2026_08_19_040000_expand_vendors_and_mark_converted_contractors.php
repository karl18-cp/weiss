<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $vendorColumns = [
            'point_of_contact' => fn (Blueprint $table) => $table->string('point_of_contact')->nullable()->after('vendor'),
            'address' => fn (Blueprint $table) => $table->string('address')->nullable()->after('point_of_contact'),
            'zip' => fn (Blueprint $table) => $table->integer('zip')->nullable()->after('address'),
            'city' => fn (Blueprint $table) => $table->text('city')->nullable()->after('zip'),
            'state' => fn (Blueprint $table) => $table->text('state')->nullable()->after('city'),
            'email' => fn (Blueprint $table) => $table->string('email')->nullable()->after('state'),
            'phone' => fn (Blueprint $table) => $table->string('phone', 50)->nullable()->after('email'),
            'license' => fn (Blueprint $table) => $table->integer('license')->nullable()->after('phone'),
            'lic_expire' => fn (Blueprint $table) => $table->date('lic_expire')->nullable()->after('license'),
            'worker_comp' => fn (Blueprint $table) => $table->date('worker_comp')->nullable()->after('lic_expire'),
            'insurance_expire' => fn (Blueprint $table) => $table->date('insurance_expire')->nullable()->after('worker_comp'),
            'source_contractor_id' => fn (Blueprint $table) => $table->integer('source_contractor_id')->nullable()->unique()->after('insurance_expire'),
        ];
        foreach ($vendorColumns as $column => $definition) {
            if (! Schema::hasColumn('vendors', $column)) {
                Schema::table('vendors', $definition);
            }
        }

        if (! Schema::hasColumn('contractors', 'moved_to_vendor_at')) {
            Schema::table('contractors', function (Blueprint $table): void {
                $table->timestamp('moved_to_vendor_at')->nullable()->after('insurance_expire');
            });
        }
    }

    public function down(): void
    {
        Schema::table('vendors', function (Blueprint $table): void {
            $table->dropColumn([
                'point_of_contact', 'address', 'zip', 'city', 'state', 'email', 'phone',
                'license', 'lic_expire', 'worker_comp', 'insurance_expire', 'source_contractor_id',
            ]);
        });
        Schema::table('contractors', fn (Blueprint $table) => $table->dropColumn('moved_to_vendor_at'));
    }
};
