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
        ];
    }
}
