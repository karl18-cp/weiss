<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'lead_id', 'account_id', 'notification_type', 'appointment_at', 'sent_at',
])]
class PushNotificationLog extends Model
{
    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'appointment_at' => 'datetime',
            'sent_at' => 'datetime',
        ];
    }
}
