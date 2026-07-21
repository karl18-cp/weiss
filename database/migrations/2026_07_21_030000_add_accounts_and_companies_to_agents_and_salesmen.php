<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('agents', function (Blueprint $table): void {
            $table->unsignedBigInteger('account_id')->nullable()->unique()->after('agent_name');
            $table->unsignedInteger('company_id')->nullable()->index()->after('account_id');
        });

        Schema::table('salesmen', function (Blueprint $table): void {
            $table->unsignedBigInteger('account_id')->nullable()->unique()->after('phone');
            $table->unsignedInteger('company_id')->nullable()->index()->after('account_id');
        });
    }

    public function down(): void
    {
        Schema::table('agents', fn (Blueprint $table) => $table->dropColumn(['account_id', 'company_id']));
        Schema::table('salesmen', fn (Blueprint $table) => $table->dropColumn(['account_id', 'company_id']));
    }
};
