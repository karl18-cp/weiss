<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('leads')) {
            return;
        }

        Schema::create('leads', function (Blueprint $table): void {
            $table->id();
            $table->string('customer_name');
            $table->string('marital_status', 50);
            $table->string('primary_number', 30);
            $table->string('secondary_number', 30)->nullable();
            $table->string('mobile_number', 30)->nullable();
            $table->string('address');
            $table->string('zip_code', 15);
            $table->string('city', 100);
            $table->string('county', 100);
            $table->string('state', 50);
            $table->string('email')->nullable();
            $table->unsignedSmallInteger('years_in_house');
            $table->unsignedInteger('product_id');
            $table->dateTime('appointment_at');
            $table->text('telemarketer_notes');
            $table->unsignedInteger('company_id');
            $table->string('source', 100);
            $table->unsignedInteger('agent_id');
            $table->unsignedInteger('created_by');
            $table->string('status', 50)->default('fresh');
            $table->text('confirmation_notes')->nullable();
            $table->timestamps();
            $table->index(['appointment_at', 'company_id', 'agent_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leads');
    }
};
