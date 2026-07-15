<?php

namespace App\Http\Requests;

use App\Support\ManagerAccess;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ManagerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    public function rules(): array
    {
        $manager = $this->route('manager');
        $accountId = $manager?->account_id;

        return [
            'manager_name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:255', Rule::unique('accounts', 'username')->ignore($accountId, 'acc_id')],
            'phone' => ['required', 'string', 'max:30'],
            'password' => [$manager ? 'nullable' : 'required', 'string', 'min:8', 'max:255'],
            'company_id' => ['required', 'integer', 'exists:companies,com_id'],
            'manager_types' => ['required', 'array', 'min:1'],
            'manager_types.*' => ['string', Rule::in(ManagerAccess::TYPES)],
            'permissions' => ['required', 'array'],
            'permissions.*' => ['required', Rule::in(['none', 'view', 'edit'])],
        ];
    }
}
