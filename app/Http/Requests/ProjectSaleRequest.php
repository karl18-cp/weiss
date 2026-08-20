<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ProjectSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'min:0.01', 'max:9999999999.99'],
            'sale_date' => ['required', 'date'],
            'product_id' => ['nullable', 'integer', 'exists:products,prod_id'],
            'files' => ['nullable', 'array', 'max:20'],
            'files.*' => ['file', 'mimes:pdf,jpg,jpeg,png,webp,heic,heif', 'max:20480'],
        ];
    }
}
