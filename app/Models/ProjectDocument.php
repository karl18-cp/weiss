<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['project_id', 'project_invoice_id', 'project_accounting_transaction_id', 'project_sale_id', 'uploaded_by', 'category', 'file_path', 'file_name', 'file_mime', 'file_size', 'drive_file_id', 'drive_url'])]
class ProjectDocument extends Model
{
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    protected function casts(): array
    {
        return ['file_size' => 'integer'];
    }
}
