<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->string('project_number', 100)->nullable()->after('id');
        });

        DB::table('projects')
            ->join('leads', 'leads.id', '=', 'projects.lead_id')
            ->leftJoin('companies', 'companies.com_id', '=', 'leads.company_id')
            ->select(['projects.id', 'companies.prefix'])
            ->orderBy('projects.id')
            ->each(function (object $project): void {
                $prefix = trim((string) ($project->prefix ?: 'PROJECT'));

                DB::table('projects')
                    ->where('id', $project->id)
                    ->update([
                        'project_number' => $prefix.'-'.str_pad((string) $project->id, 5, '0', STR_PAD_LEFT),
                    ]);
            });

        Schema::table('projects', function (Blueprint $table): void {
            $table->unique('project_number');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table): void {
            $table->dropUnique(['project_number']);
            $table->dropColumn('project_number');
        });
    }
};
