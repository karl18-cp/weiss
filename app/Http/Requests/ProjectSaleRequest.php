<?php

namespace App\Http\Requests;

use App\Models\ProjectSale;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProjectSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        $sale = $this->route('sale');
        $amountRules = $sale instanceof ProjectSale && $sale->type === 'original'
            ? ['required', 'numeric', 'min:0.01', 'max:9999999999.99']
            : ['required', 'numeric', 'not_in:0', 'between:-9999999999.99,9999999999.99'];

        return [
            'amount' => $amountRules,
            'sale_date' => ['required', 'date'],
            'product_id' => ['nullable', 'integer', 'exists:products,prod_id'],
            'salesman_id' => ['nullable', 'integer', 'exists:salesmen,salesman_id'],
            'destination' => ['nullable', Rule::in(['current', 'new_project'])],
            'project_number' => ['nullable', 'string', 'max:100'],
            'files' => ['nullable', 'array', 'max:20'],
            'files.*' => ['file', 'mimes:pdf,jpg,jpeg,png,webp,heic,heif', 'max:20480'],
        ];
    }

    public function messages(): array
    {
        return [
            'amount.not_in' => 'Enter a referral sale amount or a negative discount amount.',
        ];
    }
}
