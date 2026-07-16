<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LeadSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'min:0.01', 'max:9999999999.99'],
        ];
    }
}
