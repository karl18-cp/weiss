<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LeadSecondAgentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'agent_2_id' => [
                'required',
                'integer',
                Rule::notIn([$this->route('lead')?->agent_id]),
                'exists:agents,agent_id',
            ],
        ];
    }
}
