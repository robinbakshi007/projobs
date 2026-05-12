<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OnboardingMilestone extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'code',
        'label',
        'status',
        'progress_percent',
        'metadata_json',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata_json' => 'array',
            'completed_at' => 'datetime',
        ];
    }
}
