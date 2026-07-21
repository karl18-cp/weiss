<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['lead_id', 'agent_id', 'assigned_by', 'is_original'])]
class LeadAgentAssignment extends Model
{
    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(Agent::class, 'agent_id', 'agent_id');
    }

    public function assigner(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'assigned_by', 'acc_id');
    }

    protected function casts(): array
    {
        return ['is_original' => 'boolean'];
    }
}
