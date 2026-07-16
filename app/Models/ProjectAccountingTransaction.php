<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable([
    'project_id',
    'project_invoice_id',
    'contractor_id',
    'type',
    'category',
    'transaction_date',
    'payment_method',
    'reference_number',
    'counterparty',
    'requested_by',
    'amount',
    'status',
    'notes',
    'file_path',
    'file_name',
    'file_mime',
    'file_size',
])]
class ProjectAccountingTransaction extends Model
{
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(ProjectInvoice::class, 'project_invoice_id');
    }

    public function contractor(): BelongsTo
    {
        return $this->belongsTo(Contractor::class, 'contractor_id', 'con_id');
    }

    public function scheduledPayments(): BelongsToMany
    {
        return $this->belongsToMany(ScheduledPayment::class, 'accounting_transaction_scheduled_payment');
    }

    protected function casts(): array
    {
        return [
            'transaction_date' => 'date',
            'amount' => 'decimal:2',
            'file_size' => 'integer',
        ];
    }
}
