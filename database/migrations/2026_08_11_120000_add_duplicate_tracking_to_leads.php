<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            $table->string('primary_phone_normalized', 20)->nullable()->index()->after('primary_number');
            $table->foreignId('duplicate_of_id')->nullable()->after('calltools_contact_id')
                ->constrained('leads')->nullOnDelete();
        });

        DB::table('leads')->select(['id', 'primary_number'])->orderBy('id')->chunkById(500, function ($leads): void {
            foreach ($leads as $lead) {
                $digits = preg_replace('/\D+/', '', (string) $lead->primary_number) ?: null;
                if ($digits && strlen($digits) === 11 && str_starts_with($digits, '1')) {
                    $digits = substr($digits, 1);
                }
                DB::table('leads')->where('id', $lead->id)->update(['primary_phone_normalized' => $digits]);
            }
        });

        $canonicalByPhone = [];
        DB::table('leads')->whereNotNull('primary_phone_normalized')->orderBy('id')->get(['id', 'source', 'calltools_contact_id', 'primary_phone_normalized'])
            ->each(function ($lead) use (&$canonicalByPhone): void {
                $phone = $lead->primary_phone_normalized;
                if (! isset($canonicalByPhone[$phone])) {
                    $canonicalByPhone[$phone] = $lead->id;
                    return;
                }
                if ($lead->source === 'CallTools' && $lead->calltools_contact_id) {
                    DB::table('leads')->where('id', $lead->id)->update(['duplicate_of_id' => $canonicalByPhone[$phone]]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('duplicate_of_id');
            $table->dropColumn('primary_phone_normalized');
        });
    }
};
