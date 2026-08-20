<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'project_id',
    'project_document_id',
    'project_invoice_id',
    'contractor_id',
    'type',
    'category',
    'transaction_date',
    'payment_method',
    'reference_number',
    'invoice_order_number',
    'counterparty',
    'requested_by',
    'amount',
    'status',
    'qb',
    'notes',
    'file_path',
    'file_name',
    'file_mime',
    'file_size',
])]
class ProjectAccountingTransaction extends Model
{
    protected static function booted(): void
    {
        static::created(fn (self $transaction) => $transaction->syncLinkedInvoice());
        static::updated(function (self $transaction): void {
            $transaction->syncLinkedInvoice();

            $originalInvoiceId = $transaction->getOriginal('project_invoice_id');
            if ($originalInvoiceId && (int) $originalInvoiceId !== (int) $transaction->project_invoice_id) {
                ProjectInvoice::query()->find($originalInvoiceId)?->syncStatusFromPayables();
            }
        });
        static::deleted(fn (self $transaction) => $transaction->syncLinkedInvoice());
    }

    private function syncLinkedInvoice(): void
    {
        if ($this->project_invoice_id) {
            ProjectInvoice::query()->find($this->project_invoice_id)?->syncStatusFromPayables();
        }
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(ProjectDocument::class, 'project_document_id');
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

    public function documents(): HasMany
    {
        return $this->hasMany(ProjectDocument::class, 'project_accounting_transaction_id');
    }

    protected function casts(): array
    {
        return [
            'transaction_date' => 'date',
            'amount' => 'decimal:2',
            'qb' => 'boolean',
            'file_size' => 'integer',
        ];
    }
}
