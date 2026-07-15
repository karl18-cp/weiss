<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['salesman_name', 'phone'])]
class Salesman extends Model
{
    protected $primaryKey = 'salesman_id';
}
