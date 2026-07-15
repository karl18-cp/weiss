<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LeadNoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'note_type' => ['required', 'string', 'max:100'],
            'body' => ['required', 'string', 'max:10000'],
        ];
    }
}
