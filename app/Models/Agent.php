<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['agent_name', 'account_id', 'company_id', 'calltools_user_id', 'inactive_at'])]
class Agent extends Model
{
    protected $primaryKey = 'agent_id';

    public $timestamps = false;

    protected function casts(): array
    {
        return ['inactive_at' => 'datetime'];
    }

    public function leads(): HasMany
    {
        return $this->hasMany(Lead::class, 'agent_id', 'agent_id');
    }

    public function permissions(): HasMany
    {
        return $this->hasMany(AgentPermission::class, 'agent_id', 'agent_id');
    }

    public function attendanceSessions(): HasMany
    {
        return $this->hasMany(AgentAttendanceSession::class, 'agent_id', 'agent_id');
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(AgentSchedule::class, 'agent_id', 'agent_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'account_id', 'acc_id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id', 'com_id');
    }

    public function teams(): BelongsToMany
    {
        return $this->belongsToMany(
            Team::class,
            'agent_team',
            'agent_id',
            'team_id',
            'agent_id',
            'team_id',
        )->withTimestamps();
    }
}
