<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['agent_name', 'account_id', 'company_id'])]
class Agent extends Model
{
    protected $primaryKey = 'agent_id';

    public $timestamps = false;

    public function leads(): HasMany
    {
        return $this->hasMany(Lead::class, 'agent_id', 'agent_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'account_id', 'acc_id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id', 'com_id');
    }
}
