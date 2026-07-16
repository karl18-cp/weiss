<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProjectInvoiceRequest extends FormRequest
{
    public function rules(): array
    {
        $invoice = $this->route('invoice');

        return [
            'invoice_number' => [
                'required',
                'string',
                'max:100',
                'regex:/^INV#[A-Za-z0-9][A-Za-z0-9._\/-]*$/',
                Rule::unique('project_invoices')->where('project_id', $this->route('project')->id)->ignore($invoice?->id),
            ],
            'invoice_date' => ['required', 'date'],
            'contractor_id' => ['required', 'integer', 'exists:contractors,con_id'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:9999999999.99'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'file' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:10240'],
        ];
    }

    public function messages(): array
    {
        return [
            'invoice_number.regex' => 'Enter the invoice number after the fixed INV# prefix.',
        ];
    }
}
