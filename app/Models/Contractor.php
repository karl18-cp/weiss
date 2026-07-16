<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'contractor',
    'address',
    'zip',
    'city',
    'state',
    'email',
    'phone',
    'license',
    'lic_expire',
    'worker_comp',
    'insurance_expire',
])]
class Contractor extends Model
{
    protected $primaryKey = 'con_id';

    public $timestamps = false;

    public function projectInvoices(): HasMany
    {
        return $this->hasMany(ProjectInvoice::class, 'contractor_id', 'con_id');
    }
}
