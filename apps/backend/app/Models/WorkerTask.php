<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkerTask extends Model
{
    protected $fillable = [
        'tenant_id',
        'user_id',
        'task_type',
        'runbook_version',
        'idempotency_key',
        'foreign_ref_id',
        'payload_json',
        'retry_policy_json',
        'status',
        'checkpoint_code',
        'state_reason',
        'attempts',
        'next_retry_at',
        'last_error',
    ];

    protected $casts = [
        'next_retry_at' => 'datetime',
        'payload_json' => 'array',
        'retry_policy_json' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
