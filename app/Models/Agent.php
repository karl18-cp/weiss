<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['agent_name'])]
class Agent extends Model
{
    protected $primaryKey = 'agent_id';

    public $timestamps = false;
}
