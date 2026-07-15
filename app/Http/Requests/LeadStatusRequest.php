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
                'in:confirmed,dispatched,reschedule,555,kit,raw,cb,naov,toss,rehash,sale,ng,la,his,rehash_ng,rehash_toss,rehash_cb,kit_ng,kit_toss,kit_cb',
            ],
        ];
    }
}
