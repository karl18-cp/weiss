<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['salesman_name', 'phone', 'account_id', 'company_id'])]
class Salesman extends Model
{
    protected $primaryKey = 'salesman_id';

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
}
