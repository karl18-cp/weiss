<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ProjectAccountingTransactionRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in(['receivable', 'payable'])],
            'category' => ['required', 'string', 'max:100'],
            'transaction_date' => ['required', 'date'],
            'payment_method' => ['required', Rule::in(['check', 'zelle', 'credit_card'])],
            'reference_number' => ['required', 'string', 'max:100'],
            'counterparty' => ['nullable', 'string', 'max:255'],
            'contractor_id' => ['required_if:type,payable', 'nullable', 'integer', 'exists:contractors,con_id'],
            'requested_by' => ['nullable', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:9999999999.99'],
            'status' => ['required', Rule::in(['pending', 'ok_to_pay', 'paid'])],
            'notes' => ['nullable', 'string', 'max:5000'],
            'file' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:20480'],
            'project_invoice_id' => ['required_if:type,payable', 'nullable', 'integer', 'exists:project_invoices,id'],
            'scheduled_payment_ids' => ['nullable', 'array'],
            'scheduled_payment_ids.*' => ['integer', 'distinct', 'exists:scheduled_payments,id'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $prefix = match ($this->input('payment_method')) {
                    'check' => 'CH#',
                    'zelle' => 'ZELLE',
                    'credit_card' => 'CC-',
                    default => null,
                };

                if ($prefix && ! str_starts_with((string) $this->input('reference_number'), $prefix)) {
                    $validator->errors()->add('reference_number', "The reference number must start with {$prefix}.");
                }

                if ($prefix && trim(substr((string) $this->input('reference_number'), strlen($prefix))) === '') {
                    $validator->errors()->add('reference_number', 'Enter a reference number after the fixed prefix.');
                }
            },
        ];
    }
}
