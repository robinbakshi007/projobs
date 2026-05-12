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
        'idempotency_key',
        'foreign_ref_id',
        'payload_json',
        'status',
        'attempts',
        'next_retry_at',
        'last_error',
    ];

    protected $casts = [
        'next_retry_at' => 'datetime',
        'payload_json' => 'array',
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
