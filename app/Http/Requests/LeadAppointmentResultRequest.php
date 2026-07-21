<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LeadAppointmentResultRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'appointment_result' => [
                'nullable',
                Rule::in(['PNS', 'PNS No Rehash', '2 ND Meeting', 'Salesman Sent', 'Sold', 'Sold and Cancel']),
            ],
        ];
    }
}
