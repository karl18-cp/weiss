<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SystemTask extends Model
{
    protected $fillable = ['title', 'description', 'status', 'created_by', 'updated_by'];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'created_by', 'acc_id');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'updated_by', 'acc_id');
    }
}
