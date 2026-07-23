<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'lead_id', 'account_id', 'phone_number', 'normalized_phone', 'direction',
    'telephony_session_id', 'ringcentral_call_log_id', 'result', 'duration_seconds',
    'recording_id', 'recording_path', 'recording_content_type', 'initiated_at',
    'started_at', 'ended_at', 'matched_at', 'recorded_at',
])]
class RingCentralCall extends Model
{
    protected $table = 'ringcentral_calls';

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function caller(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'account_id', 'acc_id');
    }

    protected function casts(): array
    {
        return [
            'initiated_at' => 'datetime',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'matched_at' => 'datetime',
            'recorded_at' => 'datetime',
        ];
    }
}
