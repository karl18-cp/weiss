<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['project_payment_check_id', 'file_path', 'file_name', 'file_mime', 'file_size'])]
class ProjectPaymentCheckFile extends Model
{
    public function paymentCheck(): BelongsTo
    {
        return $this->belongsTo(ProjectPaymentCheck::class, 'project_payment_check_id');
    }
}
