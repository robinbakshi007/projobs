<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AutomationCheckpoint extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'worker_task_id',
        'skill_code',
        'selector_version',
        'checkpoint_code',
        'status',
        'details_json',
        'checkpoint_at',
    ];

    protected function casts(): array
    {
        return [
            'details_json' => 'array',
            'checkpoint_at' => 'datetime',
        ];
    }
}
