<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'customer_name', 'marital_status', 'primary_number', 'secondary_number',
    'mobile_number', 'address', 'zip_code', 'city', 'county', 'state', 'email',
    'years_in_house', 'product_id', 'appointment_at', 'appointment_result', 'telemarketer_notes',
    'company_id', 'source', 'agent_id', 'agent_2_id', 'salesman_1_id', 'salesman_2_id',
    'created_by', 'status', 'confirmation_notes',
])]
class Lead extends Model
{
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id', 'com_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id', 'prod_id');
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(Agent::class, 'agent_id', 'agent_id');
    }

    public function secondAgent(): BelongsTo
    {
        return $this->belongsTo(Agent::class, 'agent_2_id', 'agent_id');
    }

    public function salesmanOne(): BelongsTo
    {
        return $this->belongsTo(Salesman::class, 'salesman_1_id', 'salesman_id');
    }

    public function salesmanTwo(): BelongsTo
    {
        return $this->belongsTo(Salesman::class, 'salesman_2_id', 'salesman_id');
    }

    public function notes(): HasMany
    {
        return $this->hasMany(LeadNote::class)->latest();
    }

    public function latestTelemarketerNote(): HasOne
    {
        return $this->hasOne(LeadNote::class)
            ->where('note_type', 'telemarketer')
            ->latestOfMany();
    }

    public function project(): HasOne
    {
        return $this->hasOne(Project::class);
    }

    protected function casts(): array
    {
        return ['appointment_at' => 'datetime'];
    }
}
