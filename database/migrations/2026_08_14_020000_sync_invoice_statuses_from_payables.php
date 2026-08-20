<?php

use App\Models\ProjectInvoice;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        ProjectInvoice::query()->eachById(
            fn (ProjectInvoice $invoice) => $invoice->syncStatusFromPayables(),
        );
    }

    public function down(): void
    {
        // Invoice statuses are derived from their linked payables and should not be reverted.
    }
};
