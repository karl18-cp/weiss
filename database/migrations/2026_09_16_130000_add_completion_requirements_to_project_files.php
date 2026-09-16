<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_payment_checks', function (Blueprint $table) {
            $table->string('check_number', 100)->nullable()->after('amount');
        });
        Schema::table('project_documents', function (Blueprint $table) {
            $table->date('completion_date')->nullable()->after('category');
        });
    }

    public function down(): void
    {
        Schema::table('project_documents', fn (Blueprint $table) => $table->dropColumn('completion_date'));
        Schema::table('project_payment_checks', fn (Blueprint $table) => $table->dropColumn('check_number'));
    }
};
