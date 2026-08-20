<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'contractor',
    'point_of_contact',
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

    protected function casts(): array
    {
        return ['moved_to_vendor_at' => 'datetime'];
    }

    public function projectInvoices(): HasMany
    {
        return $this->hasMany(ProjectInvoice::class, 'contractor_id', 'con_id');
    }
}
