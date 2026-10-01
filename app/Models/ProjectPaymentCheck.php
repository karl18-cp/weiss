<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['project_id', 'type', 'amount', 'transaction_date', 'payment_method', 'check_number', 'pay_to', 'requested_by', 'notes', 'file_path', 'file_name', 'file_mime', 'file_size', 'paid_at'])]
class ProjectPaymentCheck extends Model
{
    public function files(): HasMany
    {
        return $this->hasMany(ProjectPaymentCheckFile::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'transaction_date' => 'date',
            'file_size' => 'integer',
            'paid_at' => 'datetime',
        ];
    }
}
