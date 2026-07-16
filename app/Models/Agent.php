<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['agent_name'])]
class Agent extends Model
{
    protected $primaryKey = 'agent_id';

    public $timestamps = false;

    public function leads(): HasMany
    {
        return $this->hasMany(Lead::class, 'agent_id', 'agent_id');
    }
}
