<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['proposal_number', 'project_id', 'lead_id', 'customer_name', 'email', 'phone', 'address', 'city', 'state', 'zip_code', 'status', 'issue_date', 'expires_at', 'scope', 'exclusions', 'payment_schedule', 'terms', 'notes', 'discount', 'tax_rate', 'subtotal', 'tax_amount', 'total', 'created_by'])]
class Proposal extends Model
{
    public function project(): BelongsTo { return $this->belongsTo(Project::class); }
    public function lead(): BelongsTo { return $this->belongsTo(Lead::class); }
    public function creator(): BelongsTo { return $this->belongsTo(Account::class, 'created_by', 'acc_id'); }
    public function items(): HasMany { return $this->hasMany(ProposalItem::class)->orderBy('sort_order')->orderBy('id'); }
    public function versions(): HasMany { return $this->hasMany(ProposalVersion::class)->latest('version'); }

    protected function casts(): array
    {
        return ['issue_date' => 'date', 'expires_at' => 'date', 'discount' => 'decimal:2', 'tax_rate' => 'decimal:3', 'subtotal' => 'decimal:2', 'tax_amount' => 'decimal:2', 'total' => 'decimal:2'];
    }
}
