<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['lead_id', 'amount', 'status', 'created_by'])]
class Project extends Model
{
    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'created_by', 'acc_id');
    }

    public function sales(): HasMany
    {
        return $this->hasMany(ProjectSale::class)->orderBy('sale_date')->orderBy('id');
    }

    public function scheduledPayments(): HasMany
    {
        return $this->hasMany(ScheduledPayment::class)->orderBy('expected_date')->orderBy('id');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(ProjectInvoice::class)->orderByDesc('invoice_date')->orderByDesc('id');
    }

    public function accountingTransactions(): HasMany
    {
        return $this->hasMany(ProjectAccountingTransaction::class)->orderByDesc('transaction_date')->orderByDesc('id');
    }

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
        ];
    }
}
