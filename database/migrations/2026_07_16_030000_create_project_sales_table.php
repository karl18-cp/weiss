<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_sales', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('type')->default('referral');
            $table->decimal('amount', 12, 2);
            $table->date('sale_date');
            $table->unsignedInteger('product_id')->nullable();
            $table->foreign('product_id')->references('prod_id')->on('products')->nullOnDelete();
            $table->timestamps();
        });

        DB::table('projects')
            ->leftJoin('leads', 'leads.id', '=', 'projects.lead_id')
            ->select(['projects.id', 'projects.amount', 'projects.created_at', 'leads.product_id'])
            ->orderBy('projects.id')
            ->each(function (object $project): void {
                DB::table('project_sales')->insert([
                    'project_id' => $project->id,
                    'type' => 'original',
                    'amount' => $project->amount,
                    'sale_date' => date('Y-m-d', strtotime((string) $project->created_at)),
                    'product_id' => $project->product_id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_sales');
    }
};
