<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['lead_id', 'from_status', 'to_status', 'moved_by'])]
class LeadMovement extends Model
{
    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function mover(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'moved_by', 'acc_id');
    }
}
