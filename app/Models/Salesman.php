<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'salesman_name', 'phone', 'account_id', 'company_id', 'inactive_at',
    'live_latitude', 'live_longitude', 'live_location_accuracy', 'live_location_updated_at',
    'initial_sale_cut_percent', 'change_order_cut_percent', 'sale_commission_percent',
])]
class Salesman extends Model
{
    protected $primaryKey = 'salesman_id';

    protected function casts(): array
    {
        return [
            'inactive_at' => 'datetime',
            'live_latitude' => 'float',
            'live_longitude' => 'float',
            'live_location_accuracy' => 'integer',
            'live_location_updated_at' => 'datetime',
            'initial_sale_cut_percent' => 'decimal:2',
            'change_order_cut_percent' => 'decimal:2',
            'sale_commission_percent' => 'decimal:2',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'account_id', 'acc_id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id', 'com_id');
    }

    public function permissions(): HasMany
    {
        return $this->hasMany(SalesmanPermission::class, 'salesman_id', 'salesman_id');
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class, 'salesman_id', 'salesman_id');
    }
}
