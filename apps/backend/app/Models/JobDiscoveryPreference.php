<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class JobDiscoveryPreference extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'role_title',
        'location',
        'work_type',
        'skills',
        'industries',
        'min_salary',
        'max_salary',
        'currency',
        'experience_level',
    ];

    protected function casts(): array
    {
        return [
            'skills' => 'array',
            'industries' => 'array',
        ];
    }

    public function results(): HasMany
    {
        return $this->hasMany(JobDiscoveryResult::class);
    }
}
