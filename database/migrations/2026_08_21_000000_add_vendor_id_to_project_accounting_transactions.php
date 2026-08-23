<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_accounting_transactions', function (Blueprint $table): void {
            $table->unsignedInteger('vendor_id')->nullable()->after('contractor_id');
            $table->foreign('vendor_id')->references('vendor_id')->on('vendors')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('project_accounting_transactions', function (Blueprint $table): void {
            $table->dropForeign(['vendor_id']);
            $table->dropColumn('vendor_id');
        });
    }
};
