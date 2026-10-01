<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Validation\ValidationException;

#[Fillable([
    'project_id',
    'project_sale_id',
    'company_id',
    'project_document_id',
    'project_invoice_id',
    'contractor_id',
    'vendor_id',
    'salesman_id',
    'type',
    'category',
    'transaction_date',
    'payment_method',
    'reference_number',
    'invoice_order_number',
    'counterparty',
    'requested_by',
    'amount',
    'status',
    'qb',
    'exclude_from_totals',
    'notes',
    'file_path',
    'file_name',
    'file_mime',
    'file_size',
])]
class ProjectAccountingTransaction extends Model
{
    protected static function booted(): void
    {
        static::saving(function (self $transaction): void {
            if ($transaction->type !== 'receivable' || $transaction->status !== 'deposit'
                || (! $transaction->isDirty('status') && ! $transaction->isDirty('project_id') && $transaction->exists)) {
                return;
            }

            $project = Project::query()->with('lead:id,company_id')->find($transaction->project_id);
            if ($project?->lead_id && blank($project->project_number)
                && ! ($project->lead?->company_id ?? $project->company_id)) {
                throw ValidationException::withMessages([
                    'company_id' => 'Assign a company before recording the first deposit and job number.',
                ]);
            }
        });
        static::created(function (self $transaction): void {
            $transaction->syncLinkedInvoice();
            $transaction->syncProjectStatus();
        });
        static::updated(function (self $transaction): void {
            $transaction->syncLinkedInvoice();

            $originalInvoiceId = $transaction->getOriginal('project_invoice_id');
            if ($originalInvoiceId && (int) $originalInvoiceId !== (int) $transaction->project_invoice_id) {
                ProjectInvoice::query()->find($originalInvoiceId)?->syncStatusFromPayables();
            }

            $transaction->syncProjectStatus();

            $originalProjectId = $transaction->getOriginal('project_id');
            if ($originalProjectId && (int) $originalProjectId !== (int) $transaction->project_id) {
                Project::query()->find($originalProjectId)?->syncStatusFromAccounting();
            }
        });
        static::deleted(function (self $transaction): void {
            $transaction->syncLinkedInvoice();
            $transaction->syncProjectStatus();
        });
    }

    private function syncLinkedInvoice(): void
    {
        if ($this->project_invoice_id) {
            ProjectInvoice::query()->find($this->project_invoice_id)?->syncStatusFromPayables();
        }
    }

    private function syncProjectStatus(): void
    {
        Project::query()->find($this->project_id)?->syncStatusFromAccounting();
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(ProjectSale::class, 'project_sale_id');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id', 'com_id');
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(ProjectDocument::class, 'project_document_id');
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(ProjectInvoice::class, 'project_invoice_id');
    }

    public function contractor(): BelongsTo
    {
        return $this->belongsTo(Contractor::class, 'contractor_id', 'con_id');
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class, 'vendor_id', 'vendor_id');
    }

    public function salesman(): BelongsTo
    {
        return $this->belongsTo(Salesman::class, 'salesman_id', 'salesman_id');
    }

    public function scheduledPayments(): BelongsToMany
    {
        return $this->belongsToMany(ScheduledPayment::class, 'accounting_transaction_scheduled_payment');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(ProjectDocument::class, 'project_accounting_transaction_id');
    }

    protected function casts(): array
    {
        return [
            'transaction_date' => 'date',
            'amount' => 'decimal:2',
            'qb' => 'boolean',
            'exclude_from_totals' => 'boolean',
            'file_size' => 'integer',
        ];
    }
}
