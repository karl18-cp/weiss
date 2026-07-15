<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;

#[Fillable(['username', 'password', 'role'])]
#[Hidden(['password'])]
class Account extends Authenticatable
{
    protected $table = 'accounts';

    protected $primaryKey = 'acc_id';

    public $timestamps = false;

    protected $appends = ['name', 'email'];

    public function getNameAttribute(): string
    {
        return $this->username;
    }

    public function getEmailAttribute(): string
    {
        return $this->username;
    }

    public function manager(): HasOne
    {
        return $this->hasOne(Manager::class, 'account_id', 'acc_id');
    }

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
        ];
    }
}
