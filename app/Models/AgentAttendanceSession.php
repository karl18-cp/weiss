<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['agent_id', 'work_date', 'clocked_in_at', 'actual_clocked_in_at', 'lunch_out_at', 'actual_lunch_out_at', 'lunch_in_at', 'actual_lunch_in_at', 'clocked_out_at', 'actual_clocked_out_at'])]
class AgentAttendanceSession extends Model
{
    protected function casts(): array
    {
        return [
            'work_date' => 'date:Y-m-d',
            'clocked_in_at' => 'datetime', 'actual_clocked_in_at' => 'datetime',
            'lunch_out_at' => 'datetime', 'actual_lunch_out_at' => 'datetime',
            'lunch_in_at' => 'datetime', 'actual_lunch_in_at' => 'datetime',
            'clocked_out_at' => 'datetime', 'actual_clocked_out_at' => 'datetime',
        ];
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(Agent::class, 'agent_id', 'agent_id');
    }
}
