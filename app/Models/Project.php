<?php

namespace App\Models;

use App\Services\ProjectNumberAllocator;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

#[Fillable([
    'project_number', 'project_number_manual', 'lead_id', 'tele_lead_excluded', 'amount', 'status', 'created_by',
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
        if (! $this->exists) return;

        DB::transaction(function (): void {
            $project = self::query()->lockForUpdate()->find($this->id);
            if (! $project || $project->status === 'canceled') return;

            $hasDeposit = $project->hasDepositedReceivable();
            if (! $hasDeposit && $project->lead_id && filled($project->project_number) && ! $project->project_number_manual) {
                $project->updateQuietly(['project_number' => null]);
            }
            if ($hasDeposit && blank($project->project_number)) {
                $companyId = $project->lead?->company_id ?? $project->company_id;
                if ($companyId) {
                    $familyId = $project->lead?->project_family_id;
                    $familyRoot = $familyId
                        ? self::query()->where('lead_id', $familyId)->first()
                        : null;
                    $allocator = app(ProjectNumberAllocator::class);
                    $project->updateQuietly([
                        'project_number' => $familyRoot && filled($familyRoot->project_number)
                            ? $allocator->allocateChild($familyRoot)
                            : $allocator->allocateForCompany((int) $companyId),
                    ]);
                } elseif ($project->lead_id) {
                    throw ValidationException::withMessages([
                        'company_id' => 'Assign a company before recording the first deposit and job number.',
                    ]);
                }
            }

            $allInvoicesPaid = ! $project->invoices()->where('status', '!=', 'paid')->exists();
            $status = $hasDeposit && $allInvoicesPaid && $project->completionBlockers() === []
                ? 'completed'
                : ($hasDeposit ? 'progress' : 'new');

            if ($project->status !== $status) {
                $project->updateQuietly(['status' => $status]);
            }
        });
    }

    public function hasDepositedReceivable(): bool
    {
        return $this->accountingTransactions()
            ->where('type', 'receivable')
            ->where('status', 'deposit')
            ->exists();
    }

    /** @return list<string> */
    public function completionBlockers(): array
    {
        $blockers = [];
        $documents = $this->documents()->get([
            'id', 'project_sale_id', 'project_invoice_id', 'project_accounting_transaction_id',
            'category', 'completion_date', 'file_path',
        ]);
        $sales = $this->sales()->get(['id', 'type']);
        if ($sales->isEmpty()) $blockers[] = 'Record the original sale.';
        foreach ($sales as $sale) {
            $hasSaleScan = $documents->contains(fn (ProjectDocument $document): bool =>
                (int) $document->project_sale_id === (int) $sale->id && filled($document->file_path));
            if (! $hasSaleScan && ! ($sale->type === 'original' && filled($this->contract_file_path))) {
                $blockers[] = 'Scan and attach the '.($sale->type === 'referral' ? 'referral' : 'original')." sale #{$sale->id}.";
            }
        }
        $invoices = $this->invoices()->get(['id', 'status', 'file_path', 'project_document_id']);
        $openInvoices = $invoices->where('status', '!=', 'paid')->count();
        $unscannedInvoices = $invoices->filter(
            fn (ProjectInvoice $invoice): bool => blank($invoice->file_path)
                && ! $documents->contains(fn (ProjectDocument $document): bool =>
                    (int) $document->project_invoice_id === (int) $invoice->id && filled($document->file_path))
                && ! $documents->contains(fn (ProjectDocument $document): bool =>
                    (int) $document->id === (int) $invoice->project_document_id && filled($document->file_path)),
        )->count();

        if ($openInvoices > 0) $blockers[] = "Pay all invoices ({$openInvoices} open).";
        if ($unscannedInvoices > 0) $blockers[] = "Scan and attach every invoice ({$unscannedInvoices} missing).";

        foreach ($this->accountingTransactions()->where('exclude_from_totals', false)->get(['id', 'type', 'category', 'file_path', 'project_document_id']) as $transaction) {
            $hasScan = filled($transaction->file_path) || $documents->contains(fn (ProjectDocument $document): bool =>
                filled($document->file_path) && (
                    (int) $document->project_accounting_transaction_id === (int) $transaction->id
                    || (int) $document->id === (int) $transaction->project_document_id
                ));
            if (! $hasScan) {
                $label = str_contains(strtolower((string) $transaction->category), 'commission')
                    ? 'commission' : $transaction->type;
                $blockers[] = "Scan and attach the {$label} transaction #{$transaction->id}.";
            }
        }

        foreach (['lead_cost' => 'LC', 'commission' => 'CO'] as $type => $label) {
            $check = $this->paymentChecks()->where('type', $type)->first();
            if (! $check || blank($check->check_number)) $blockers[] = "Enter the {$label} check number.";
            if (! $check || (blank($check->file_path) && ! $check->files()->exists())) $blockers[] = "Scan and upload the {$label} check.";
        }

        $completionForm = $documents->contains(fn (ProjectDocument $document): bool =>
            str_starts_with((string) $document->category, 'Completion Form')
            && filled($document->completion_date) && filled($document->file_path));
        if (! $completionForm) $blockers[] = 'Upload the completion form and enter its date.';

        $hasContract = filled($this->contract_file_path)
            || $documents->contains(fn (ProjectDocument $document): bool =>
                $document->category === 'Sale Contract' && filled($document->file_path));
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
            'project_number_manual' => 'boolean',
        ];
    }
}
