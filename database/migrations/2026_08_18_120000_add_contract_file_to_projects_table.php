<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->string('contract_file_path')->nullable()->after('manual_notes');
            $table->string('contract_file_name')->nullable()->after('contract_file_path');
            $table->string('contract_file_mime')->nullable()->after('contract_file_name');
            $table->unsignedBigInteger('contract_file_size')->nullable()->after('contract_file_mime');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->dropColumn(['contract_file_path', 'contract_file_name', 'contract_file_mime', 'contract_file_size']);
        });
    }
};
