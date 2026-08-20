<?php

namespace App\Http\Requests;

use App\Support\ManagerAccess;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class VendorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() && ManagerAccess::canEdit($this->user(), 'contacts_users');
    }

    public function rules(): array
    {
        return [
            'vendor' => [
                'required',
                'string',
                'max:255',
                Rule::unique('vendors', 'vendor')->ignore($this->route('vendor')?->vendor_id, 'vendor_id'),
            ],
            'point_of_contact' => ['nullable', 'string', 'max:255'],
            'address' => ['required', 'string', 'max:255'],
            'zip' => ['required', 'integer', 'min:0'],
            'city' => ['required', 'string', 'max:255'],
            'state' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['required', 'string', 'max:50', 'regex:/^[0-9+().\-\s]+$/'],
            'license' => ['nullable', 'integer', 'min:0'],
            'lic_expire' => ['nullable', 'date'],
            'worker_comp' => ['nullable', 'date'],
            'insurance_expire' => ['nullable', 'date'],
        ];
    }
}
