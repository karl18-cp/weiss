<?php

namespace App\Http\Requests;

use App\Models\Agent;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AgentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    public function rules(): array
    {
        $agent = $this->route('agent');

        return [
            'agent_name' => [
                'required',
                'string',
                'max:255',
                Rule::unique(Agent::class, 'agent_name')->ignore($agent),
            ],
            'company_id' => ['required', 'integer', 'exists:companies,com_id'],
            'username' => [
                'nullable', 'string', 'max:255', 'required_with:password',
                Rule::unique('accounts', 'username')->ignore($agent?->account_id, 'acc_id'),
            ],
            'password' => [
                Rule::requiredIf($this->filled('username') && ! $agent?->account_id),
                'nullable', 'string', 'min:8', 'max:255',
            ],
        ];
    }
}
