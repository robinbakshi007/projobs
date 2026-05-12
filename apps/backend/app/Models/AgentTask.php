<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AgentTask extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'agent_id',
        'task_type',
        'status',
        'payload_json',
        'result_json',
        'extension_ref',
        'started_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'payload_json' => 'array',
            'result_json' => 'array',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }
}
