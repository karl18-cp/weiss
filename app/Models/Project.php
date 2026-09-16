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
    protected static function booted(): void
    {
        static::saved(fn (self $project) => $project->syncStatusFromAccounting());
    }

    public function syncStatusFromAccounting(): void
    {
        if ($this->status === 'canceled') {
            return;
        }

        $hasInvoices = $this->invoices()->exists();
        $hasAccounting = $this->accountingTransactions()->exists();
        $allInvoicesPaid = ! $this->invoices()->where('status', '!=', 'paid')->exists();

        $status = $allInvoicesPaid && $this->completionBlockers() === []
            ? 'completed'
            : ($hasInvoices || $hasAccounting ? 'progress' : 'new');

        if ($this->status !== $status) {
            $this->updateQuietly(['status' => $status]);
        }
    }

    /** @return list<string> */
    public function completionBlockers(): array
    {
        $blockers = [];
        $invoices = $this->invoices()->get(['id', 'status', 'file_path', 'project_document_id']);
        $openInvoices = $invoices->where('status', '!=', 'paid')->count();
        $unscannedInvoices = $invoices->filter(
            fn (ProjectInvoice $invoice): bool => blank($invoice->file_path) && blank($invoice->project_document_id),
        )->count();

        if ($openInvoices > 0) $blockers[] = "Pay all invoices ({$openInvoices} open).";
        if ($unscannedInvoices > 0) $blockers[] = "Scan and attach every invoice ({$unscannedInvoices} missing).";

        foreach (['lead_cost' => 'LC', 'commission' => 'CO'] as $type => $label) {
            $check = $this->paymentChecks()->where('type', $type)->first();
            if (! $check || blank($check->check_number)) $blockers[] = "Enter the {$label} check number.";
            if (! $check || blank($check->file_path)) $blockers[] = "Scan and upload the {$label} check.";
        }

        $completionForm = $this->documents()
            ->where('category', 'like', 'Completion Form%')
            ->whereNotNull('completion_date')
            ->exists();
        if (! $completionForm) $blockers[] = 'Upload the completion form and enter its date.';

        $hasContract = filled($this->contract_file_path)
            || $this->documents()->where('category', 'Sale Contract')->exists();
        if (! $hasContract) $blockers[] = 'Scan and attach the contract.';

        return $blockers;
    }

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

    public function paymentChecks(): HasMany
    {
        return $this->hasMany(ProjectPaymentCheck::class);
    }

    public function activityLogs(): HasMany
    {
        return $this->hasMany(ProjectActivityLog::class)->latest();
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
