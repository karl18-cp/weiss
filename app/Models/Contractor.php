<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

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
}
