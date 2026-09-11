<?php

namespace App\Http\Requests;

use App\Support\ManagerAccess;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() && ManagerAccess::canEdit($this->user(), 'contacts_users');
    }

    public function rules(): array
    {
        return [
            'product_name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('products', 'product_name')
                    ->ignore($this->route('product')),
            ],
            'price' => ['nullable', 'numeric', 'min:0', 'max:9999999999.99'],
            'unit' => [
                'nullable',
                Rule::in([
                    'Bag',
                    'Cubic Foot',
                    'Cubic Yard',
                    'Each',
                    'Foot',
                    'Gallon',
                    'Hour',
                    'Linear Foot',
                    'Pallet',
                    'Pound',
                    'Roll',
                    'Sheet',
                    'Square Foot',
                    'Square Yard',
                    'Stick',
                    'Ton',
                    'Yard',
                ]),
            ],
            'description' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
