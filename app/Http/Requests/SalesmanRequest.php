<?php

namespace App\Http\Requests;

use App\Support\ManagerAccess;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SalesmanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() && ManagerAccess::canEdit($this->user(), 'contacts_users');
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
            'suspended' => ['sometimes', 'boolean'],
            'initial_sale_cut_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'change_order_cut_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'sale_commission_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'permissions' => ['required', 'array'],
            'permissions.*' => ['required', Rule::in(['none', 'view', 'edit'])],
        ];
    }
}
