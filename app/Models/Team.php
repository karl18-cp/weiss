<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable(['team_name', 'manager_id'])]
class Team extends Model
{
    protected $primaryKey = 'team_id';

    public function manager(): BelongsTo
    {
        return $this->belongsTo(Manager::class, 'manager_id', 'manager_id');
    }

    public function agents(): BelongsToMany
    {
        return $this->belongsToMany(
            Agent::class,
            'agent_team',
            'team_id',
            'agent_id',
            'team_id',
            'agent_id',
        )->withTimestamps();
    }
}
