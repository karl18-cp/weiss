<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['com_id', 'company', 'address', 'prefix', 'project_code'])]
class Company extends Model
{
    protected $table = 'companies';

    protected $primaryKey = 'com_id';

    public $incrementing = false;

    public $timestamps = false;

    protected $keyType = 'int';
}
