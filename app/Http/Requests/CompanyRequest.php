<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CompanyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    public function rules(): array
    {
        return [
            'company' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'prefix' => ['required', 'string', 'max:255'],
            'project_code' => ['required', 'string', 'max:255'],
        ];
    }
}
