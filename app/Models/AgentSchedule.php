<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['agent_id', 'weekday', 'is_working', 'shift_start', 'shift_end', 'lunch_start', 'lunch_end'])]
class AgentSchedule extends Model
{
    protected function casts(): array
    {
        return ['is_working' => 'boolean', 'weekday' => 'integer'];
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(Agent::class, 'agent_id', 'agent_id');
    }
}
