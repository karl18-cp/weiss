<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['proposal_id', 'product_id', 'name', 'description', 'quantity', 'unit', 'unit_price', 'total', 'sort_order'])]
class ProposalItem extends Model
{
    public function proposal(): BelongsTo { return $this->belongsTo(Proposal::class); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class, 'product_id', 'prod_id'); }
    protected function casts(): array { return ['quantity' => 'decimal:3', 'unit_price' => 'decimal:2', 'total' => 'decimal:2']; }
}
