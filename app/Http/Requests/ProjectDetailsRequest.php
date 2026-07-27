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
                'required',
                'string',
                'max:100',
                Rule::unique('projects', 'project_number')->ignore($this->route('project')),
            ],
            'status' => ['required', 'in:new,progress,completed,canceled'],
        ];
    }
}
