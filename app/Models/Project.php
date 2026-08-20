<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'project_number', 'lead_id', 'tele_lead_excluded', 'amount', 'status', 'created_by',
    'customer_name', 'contact_name', 'company_id', 'product_id',
    'telemarketer_id', 'salesman_id', 'manager_id', 'runner',
    'primary_number', 'mobile_number', 'email', 'address', 'city', 'state',
    'zip_code', 'budget', 'manual_notes',
    'contract_file_path', 'contract_file_name', 'contract_file_mime', 'contract_file_size',
])]
class Project extends Model
{
    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'created_by', 'acc_id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id', 'com_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id', 'prod_id');
    }

    public function telemarketer(): BelongsTo
    {
        return $this->belongsTo(Agent::class, 'telemarketer_id', 'agent_id');
    }

    public function salesman(): BelongsTo
    {
        return $this->belongsTo(Salesman::class, 'salesman_id', 'salesman_id');
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(Manager::class, 'manager_id', 'manager_id');
    }

    public function sales(): HasMany
    {
        return $this->hasMany(ProjectSale::class)->orderBy('sale_date')->orderBy('id');
    }

    public function scheduledPayments(): HasMany
    {
        return $this->hasMany(ScheduledPayment::class)->orderBy('expected_date')->orderBy('id');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(ProjectInvoice::class)->orderByDesc('invoice_date')->orderByDesc('id');
    }

    public function accountingTransactions(): HasMany
    {
        return $this->hasMany(ProjectAccountingTransaction::class)->orderByDesc('transaction_date')->orderByDesc('id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(ProjectDocument::class)->latest();
    }

    public function contractors(): BelongsToMany
    {
        return $this->belongsToMany(
            Contractor::class,
            'project_contractor_assignments',
            'project_id',
            'contractor_id',
            'id',
            'con_id',
        )->withPivot('position')->withTimestamps()->orderByPivot('position');
    }

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'budget' => 'decimal:2',
            'tele_lead_excluded' => 'boolean',
        ];
    }
}
