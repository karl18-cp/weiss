<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['project_id', 'type', 'amount', 'sale_date', 'product_id', 'salesman_id'])]
class ProjectSale extends Model
{
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id', 'prod_id');
    }

    public function salesman(): BelongsTo
    {
        return $this->belongsTo(Salesman::class, 'salesman_id', 'salesman_id');
    }

    public function accountingTransactions(): HasMany
    {
        return $this->hasMany(ProjectAccountingTransaction::class, 'project_sale_id');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(ProjectInvoice::class, 'project_sale_id');
    }

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'sale_date' => 'date',
        ];
    }
}
