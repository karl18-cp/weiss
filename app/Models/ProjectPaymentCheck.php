<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['project_id', 'type', 'amount', 'file_path', 'file_name', 'file_mime', 'file_size', 'paid_at'])]
class ProjectPaymentCheck extends Model
{
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'file_size' => 'integer',
            'paid_at' => 'datetime',
        ];
    }
}
