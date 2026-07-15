<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['account_id', 'manager_name', 'phone', 'company_id', 'manager_types'])]
class Manager extends Model
{
    protected $primaryKey = 'manager_id';

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
        return $this->hasMany(ManagerPermission::class, 'manager_id', 'manager_id');
    }

    protected function casts(): array
    {
        return ['manager_types' => 'array'];
    }
}
