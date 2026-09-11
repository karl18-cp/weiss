<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['project_id', 'actor_id', 'subject_type', 'subject_id', 'action', 'description', 'old_values', 'new_values'])]
class ProjectActivityLog extends Model
{
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'actor_id', 'acc_id');
    }

    protected function casts(): array
    {
        return ['old_values' => 'array', 'new_values' => 'array'];
    }
}
