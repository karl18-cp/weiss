<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['proposal_id', 'version', 'file_path', 'file_name', 'generated_by'])]
class ProposalVersion extends Model
{
    public function proposal(): BelongsTo { return $this->belongsTo(Proposal::class); }
}
