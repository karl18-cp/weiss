<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProjectDetailsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'project_number' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique('projects', 'project_number')->ignore($this->route('project')),
            ],
            'status' => ['required', 'in:new,progress,completed,canceled'],
            'company_id' => ['required', 'integer', 'exists:companies,com_id'],
            'product_id' => ['required', 'integer', 'exists:products,prod_id'],
            'customer_name' => ['required', 'string', 'max:255'],
            'primary_number' => ['required', 'string', 'max:50'],
            'secondary_number' => ['nullable', 'string', 'max:50'],
            'mobile_number' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['required', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:100'],
            'state' => ['required', 'string', 'max:50'],
            'zip_code' => ['required', 'string', 'max:20'],
            'source' => ['required', 'string', 'max:255'],
            'appointment_at' => ['nullable', 'date'],
            'lead_created_at' => ['required', 'date'],
        ];
    }

    public function messages(): array
    {
        return [
            'project_number.unique' => 'This project number already exists.',
        ];
    }
}
