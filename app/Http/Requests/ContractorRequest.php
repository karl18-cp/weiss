<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ContractorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    public function rules(): array
    {
        return [
            'contractor' => ['required', 'string', 'max:255'],
            'address' => ['required', 'string', 'max:255'],
            'zip' => ['required', 'integer', 'min:0'],
            'city' => ['required', 'string', 'max:255'],
            'state' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['required', 'integer', 'min:0'],
            'license' => ['nullable', 'integer', 'min:0'],
            'lic_expire' => ['nullable', 'date'],
            'worker_comp' => ['nullable', 'date'],
            'insurance_expire' => ['nullable', 'date'],
        ];
    }
}
