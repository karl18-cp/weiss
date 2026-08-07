<?php

namespace App\Http\Requests;

use App\Support\ManagerAccess;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TeamRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() && ManagerAccess::canEdit($this->user(), 'contacts_users');
    }

    public function rules(): array
    {
        $team = $this->route('team');

        return [
            'team_name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('teams', 'team_name')
                    ->where(fn ($query) => $query->where('manager_id', $this->integer('manager_id')))
                    ->ignore($team?->team_id, 'team_id'),
            ],
            'manager_id' => ['required', 'integer', 'exists:managers,manager_id'],
            'agent_ids' => ['required', 'array', 'min:1'],
            'agent_ids.*' => [
                'required',
                'integer',
                'distinct',
                Rule::exists('agents', 'agent_id')->whereNull('inactive_at'),
            ],
        ];
    }
}
