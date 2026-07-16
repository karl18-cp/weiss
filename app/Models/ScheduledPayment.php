<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'project_id', 'expected_date', 'payment_stage', 'amount', 'qb', 'printed_sent', 'notes',
])]
class ScheduledPayment extends Model
{
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    protected function casts(): array
    {
        return [
            'expected_date' => 'date',
            'amount' => 'decimal:2',
            'qb' => 'boolean',
            'printed_sent' => 'boolean',
        ];
    }
}
