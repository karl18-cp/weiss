<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LeadStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'status' => [
                'required',
                'in:fresh,confirmed,dispatched,reschedule,555,kit,raw,cb,naov,verify,toss,rehash,ng,la,his,rehash_ng,rehash_toss,rehash_cb,kit_ng,kit_toss,kit_cb',
            ],
            'appointment_result_note' => ['nullable', 'string', 'max:5000'],
            'follow_up_at' => ['nullable', 'date', 'after:now'],
        ];
    }
}
