<?php

namespace App\Http\Requests;

use App\Models\ProjectAccountingTransaction;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ReceivableQuickBooksRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'qb' => ['required', 'boolean'],
            'payment_method' => ['nullable', Rule::in(['check', 'zelle', 'credit_card', 'wire_transfer', 'square_transfer', 'cash'])],
            'reference_number' => ['nullable', 'string', 'max:100'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if (! $this->boolean('qb')) {
                    return;
                }

                /** @var ProjectAccountingTransaction|null $transaction */
                $transaction = $this->route('accountingTransaction');
                $method = $this->input('payment_method') ?: $transaction?->payment_method;
                $reference = $this->input('reference_number') ?: $transaction?->reference_number;

                if (! $method) {
                    $validator->errors()->add('payment_method', 'Select a payment method before moving this receivable to QB.');
                }

                if (! $reference) {
                    return;
                }

                $prefix = match ($method) {
                    'check' => 'CH#',
                    'zelle' => 'ZELLE',
                    'credit_card' => 'CC-',
                    'wire_transfer' => 'WIRE-',
                    'square_transfer' => 'SQUARE-',
                    'cash' => 'CASH-',
                    default => null,
                };

                if ($prefix && ! str_starts_with($reference, $prefix)) {
                    $validator->errors()->add('reference_number', "The reference number must start with {$prefix}.");
                }
            },
        ];
    }
}
