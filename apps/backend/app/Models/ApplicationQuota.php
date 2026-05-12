<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ApplicationQuota extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'date_key',
        'max_applications',
        'applied_count',
        'reserved_count',
        'updated_at',
    ];

    protected function casts(): array
    {
        return [
            'date_key' => 'date',
            'updated_at' => 'datetime',
        ];
    }
}
