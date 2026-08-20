<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'vendor', 'point_of_contact', 'address', 'zip', 'city', 'state', 'email', 'phone',
    'license', 'lic_expire', 'worker_comp', 'insurance_expire', 'source_contractor_id',
])]
class Vendor extends Model
{
    protected $primaryKey = 'vendor_id';

    public function projectInvoices(): HasMany
    {
        return $this->hasMany(ProjectInvoice::class, 'vendor_id', 'vendor_id');
    }
}
