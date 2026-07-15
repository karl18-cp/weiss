<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['product_name'])]
class Product extends Model
{
    protected $table = 'products';

    protected $primaryKey = 'prod_id';

    public $timestamps = false;
}
