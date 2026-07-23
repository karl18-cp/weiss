<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SalesmanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        $salesman = $this->route('salesman');

        return [
            'salesman_name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:30'],
            'company_id' => ['required', 'integer', 'exists:companies,com_id'],
            'username' => [
                'nullable', 'string', 'max:255', 'required_with:password',
                Rule::unique('accounts', 'username')->ignore($salesman?->account_id, 'acc_id'),
            ],
            'password' => [
                Rule::requiredIf($this->filled('username') && ! $salesman?->account_id),
                'nullable', 'string', 'min:8', 'max:255',
            ],
            'permissions' => ['required', 'array'],
            'permissions.*' => ['required', Rule::in(['none', 'view', 'edit'])],
        ];
    }
}
