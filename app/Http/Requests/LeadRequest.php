<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LeadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'customer_name' => ['required', 'string', 'max:255'],
            'marital_status' => ['required', 'string', 'max:50'],
            'primary_number' => ['required', 'string', 'max:30'],
            'secondary_number' => ['nullable', 'string', 'max:30'],
            'mobile_number' => ['nullable', 'string', 'max:30'],
            'address' => ['required', 'string', 'max:255'],
            'zip_code' => ['required', 'string', 'max:15'],
            'city' => ['required', 'string', 'max:100'],
            'county' => ['required', 'string', 'max:100'],
            'state' => ['required', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'years_in_house' => ['required', 'integer', 'min:0', 'max:150'],
            // Legacy leads may already be in downstream queues without these
            // newer qualification fields. Do not block an unrelated edit there;
            // updateStatus() still requires them before a Leads Shop lead moves
            // into a downstream queue.
            'house_age' => ['nullable', 'integer', 'min:0', 'max:500'],
            'needs_financing' => ['nullable', 'boolean'],
            'house_value' => ['nullable', 'numeric', 'min:0', 'max:999999999999.99'],
            'product_id' => ['required', 'integer', 'exists:products,prod_id'],
            'appointment_at' => ['required', 'date'],
            'appointment_result' => ['nullable', 'string', 'in:PNS,PNS No Rehash,2 ND Meeting,Salesman Sent,Sold and Cancel'],
            'telemarketer_notes' => ['required', 'string', 'max:5000'],
            'company_id' => ['required', 'integer', 'exists:companies,com_id'],
            'source' => ['required', 'in:CallTools'],
            'agent_id' => ['required', 'integer', 'exists:agents,agent_id'],
            'salesman_1_id' => ['nullable', 'integer', 'exists:salesmen,salesman_id'],
            'salesman_2_id' => ['nullable', 'integer', 'different:salesman_1_id', 'exists:salesmen,salesman_id'],
        ];
    }
}
