<?php

use App\Support\ManagerAccess;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_permissions', function (Blueprint $table): void {
            $table->id();
            $table->unsignedInteger('agent_id');
            $table->string('module', 60);
            $table->string('access_level', 10)->default('none');
            $table->timestamps();
            $table->unique(['agent_id', 'module']);
            $table->foreign('agent_id')->references('agent_id')->on('agents')->cascadeOnDelete();
        });

        Schema::create('salesman_permissions', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('salesman_id');
            $table->string('module', 60);
            $table->string('access_level', 10)->default('none');
            $table->timestamps();
            $table->unique(['salesman_id', 'module']);
            $table->foreign('salesman_id')->references('salesman_id')->on('salesmen')->cascadeOnDelete();
        });

        $now = now();
        foreach (array_keys(ManagerAccess::MODULES) as $module) {
            DB::table('agents')->whereNotNull('account_id')->pluck('agent_id')->each(
                fn ($id) => DB::table('agent_permissions')->insert([
                    'agent_id' => $id, 'module' => $module, 'access_level' => 'edit',
                    'created_at' => $now, 'updated_at' => $now,
                ]),
            );
            DB::table('salesmen')->whereNotNull('account_id')->pluck('salesman_id')->each(
                fn ($id) => DB::table('salesman_permissions')->insert([
                    'salesman_id' => $id, 'module' => $module, 'access_level' => 'edit',
                    'created_at' => $now, 'updated_at' => $now,
                ]),
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('salesman_permissions');
        Schema::dropIfExists('agent_permissions');
    }
};
