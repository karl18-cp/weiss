<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('proposals', function (Blueprint $table): void {
            $table->id();
            $table->string('proposal_number')->unique();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('lead_id')->nullable()->constrained()->nullOnDelete();
            $table->string('customer_name');
            $table->string('email')->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('address')->nullable();
            $table->string('city')->nullable();
            $table->string('state', 30)->nullable();
            $table->string('zip_code', 20)->nullable();
            $table->string('status', 30)->default('Draft');
            $table->date('issue_date');
            $table->date('expires_at')->nullable();
            $table->text('scope')->nullable();
            $table->text('exclusions')->nullable();
            $table->text('payment_schedule')->nullable();
            $table->text('terms')->nullable();
            $table->text('notes')->nullable();
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('tax_rate', 6, 3)->default(0);
            $table->decimal('subtotal', 14, 2)->default(0);
            $table->decimal('tax_amount', 14, 2)->default(0);
            $table->decimal('total', 14, 2)->default(0);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->index(['status', 'issue_date']);
        });

        Schema::create('proposal_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('proposal_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('product_id')->nullable();
            $table->string('name');
            $table->text('description')->nullable();
            $table->decimal('quantity', 12, 3)->default(1);
            $table->string('unit', 50)->nullable();
            $table->decimal('unit_price', 14, 2)->default(0);
            $table->decimal('total', 14, 2)->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->foreign('product_id')->references('prod_id')->on('products')->nullOnDelete();
        });

        Schema::create('proposal_versions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('proposal_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->string('file_path');
            $table->string('file_name');
            $table->unsignedBigInteger('generated_by')->nullable();
            $table->timestamps();
            $table->unique(['proposal_id', 'version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('proposal_versions');
        Schema::dropIfExists('proposal_items');
        Schema::dropIfExists('proposals');
    }
};
