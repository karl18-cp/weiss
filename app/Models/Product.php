<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['product_name', 'price', 'unit', 'description'])]
class Product extends Model
{
    protected $table = 'products';

    protected $primaryKey = 'prod_id';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
        ];
    }
}
