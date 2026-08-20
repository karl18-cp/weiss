<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'project_id',
    'project_document_id',
    'contractor_id',
    'vendor_id',
    'invoice_number',
    'invoice_date',
    'amount',
    'notes',
    'status',
    'file_path',
    'file_name',
    'file_mime',
    'file_size',
])]
class ProjectInvoice extends Model
{
    public function syncStatusFromPayables(): void
    {
        $payables = $this->accountingTransactions()
            ->where('type', 'payable')
            ->get(['amount', 'status']);

        $paidTotal = (float) $payables->where('status', 'paid')->sum('amount');
        $allPaid = $payables->isNotEmpty()
            && $payables->every(fn (ProjectAccountingTransaction $payable): bool => $payable->status === 'paid');
        $fullyPaid = $allPaid && round($paidTotal, 2) >= round((float) $this->amount, 2);

        $status = $fullyPaid
            ? 'paid'
            : ($payables->contains(fn (ProjectAccountingTransaction $payable): bool => in_array($payable->status, ['ok_to_pay', 'paid'], true))
                ? 'ok_to_pay'
                : 'pending');

        if ($this->status !== $status) {
            $this->updateQuietly(['status' => $status]);
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

    public function contractor(): BelongsTo
    {
        return $this->belongsTo(Contractor::class, 'contractor_id', 'con_id');
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class, 'vendor_id', 'vendor_id');
    }

    public function accountingTransactions(): HasMany
    {
        return $this->hasMany(ProjectAccountingTransaction::class, 'project_invoice_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(ProjectDocument::class, 'project_invoice_id');
    }

    protected function casts(): array
    {
        return [
            'invoice_date' => 'date',
            'amount' => 'decimal:2',
            'file_size' => 'integer',
        ];
    }
}
