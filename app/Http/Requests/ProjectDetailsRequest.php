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
            // Older imported projects do not always have all of these values.
            // They must still be editable without forcing the user to invent
            // unrelated data just to save one changed field.
            'company_id' => ['nullable', 'integer', 'exists:companies,com_id'],
            'product_id' => ['nullable', 'integer', 'exists:products,prod_id'],
            'customer_name' => ['required', 'string', 'max:255'],
            'primary_number' => ['nullable', 'string', 'max:50'],
            'secondary_number' => ['nullable', 'string', 'max:50'],
            'mobile_number' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'string', 'max:50'],
            'zip_code' => ['nullable', 'string', 'max:20'],
            'source' => ['nullable', 'string', 'max:255'],
            'appointment_at' => ['nullable', 'date'],
            'lead_created_at' => ['required', 'date'],
            'agent_id' => ['nullable', 'integer', 'exists:agents,agent_id'],
            'agent_2_id' => ['nullable', 'integer', 'different:agent_id', 'exists:agents,agent_id'],
            'salesman_1_id' => ['nullable', 'integer', 'exists:salesmen,salesman_id'],
            'salesman_2_id' => ['nullable', 'integer', 'different:salesman_1_id', 'exists:salesmen,salesman_id'],
        ];
    }

    public function messages(): array
    {
        return [
            'project_number.unique' => 'This project number already exists.',
        ];
    }
}
