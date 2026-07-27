<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'account_id', 'endpoint', 'public_key', 'auth_token', 'content_encoding',
])]
class PushSubscription extends Model {}
