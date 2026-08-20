<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vendors', function (Blueprint $table): void {
            $table->increments('vendor_id');
            $table->string('vendor')->unique();
            $table->timestamps();
        });

        Schema::table('project_invoices', function (Blueprint $table): void {
            $table->dropForeign(['contractor_id']);
        });
        Schema::table('project_invoices', function (Blueprint $table): void {
            $table->integer('contractor_id')->nullable()->change();
            $table->unsignedInteger('vendor_id')->nullable()->after('contractor_id');
            $table->foreign('contractor_id')->references('con_id')->on('contractors')->restrictOnDelete();
            $table->foreign('vendor_id')->references('vendor_id')->on('vendors')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('project_invoices', function (Blueprint $table): void {
            $table->dropForeign(['vendor_id']);
            $table->dropColumn('vendor_id');
        });
        Schema::dropIfExists('vendors');
    }
};
