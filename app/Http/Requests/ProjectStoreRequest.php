<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProjectStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'customer_name' => ['required', 'string', 'max:255'],
            'contact_name' => ['nullable', 'string', 'max:255'],
            'primary_number' => ['required', 'string', 'max:30'],
            'mobile_number' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'string', 'max:50'],
            'zip_code' => ['nullable', 'string', 'max:15'],
            'company_id' => ['required', 'integer', 'exists:companies,com_id'],
            'product_id' => ['required', 'integer', 'exists:products,prod_id'],
            'telemarketer_id' => ['nullable', 'integer', 'exists:agents,agent_id'],
            'salesman_id' => ['nullable', 'integer', 'exists:salesmen,salesman_id'],
            'manager_id' => ['nullable', 'integer', 'exists:managers,manager_id'],
            'project_number' => ['exclude_unless:status,progress', 'nullable', 'string', 'max:100', Rule::unique('projects', 'project_number')],
            'status' => ['required', 'in:new,progress,completed,canceled'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:9999999999.99'],
            'budget' => ['nullable', 'numeric', 'min:0', 'max:9999999999.99'],
            'notes' => ['nullable', 'string', 'max:10000'],
            'signed_date' => ['required', 'date'],
        ];
    }

    public function messages(): array
    {
        return [
            'project_number.unique' => 'This project number already exists.',
        ];
    }
}
