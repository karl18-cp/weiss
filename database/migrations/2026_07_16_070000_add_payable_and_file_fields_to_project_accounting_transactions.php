<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('project_accounting_transactions', 'contractor_id')) {
            Schema::table('project_accounting_transactions', function (Blueprint $table): void {
                $table->integer('contractor_id')->nullable()->after('project_invoice_id');
            });
        }

        foreach ([
            'representative' => 'counterparty',
            'requested_by' => 'representative',
            'file_path' => 'notes',
            'file_name' => 'file_path',
            'file_mime' => 'file_name',
        ] as $column => $after) {
            if (! Schema::hasColumn('project_accounting_transactions', $column)) {
                Schema::table('project_accounting_transactions', function (Blueprint $table) use ($column, $after): void {
                    $table->string($column)->nullable()->after($after);
                });
            }
        }

        if (! Schema::hasColumn('project_accounting_transactions', 'file_size')) {
            Schema::table('project_accounting_transactions', function (Blueprint $table): void {
                $table->unsignedBigInteger('file_size')->nullable()->after('file_mime');
            });
        }

        Schema::table('project_accounting_transactions', function (Blueprint $table): void {
            $table->integer('contractor_id')->nullable()->change();
            $table->foreign('contractor_id', 'accounting_transaction_contractor_fk')
                ->references('con_id')
                ->on('contractors')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('project_accounting_transactions', function (Blueprint $table): void {
            $table->dropForeign('accounting_transaction_contractor_fk');
            $table->dropColumn([
                'contractor_id',
                'representative',
                'requested_by',
                'file_path',
                'file_name',
                'file_mime',
                'file_size',
            ]);
        });
    }
};
