<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OtpChallenge extends Model
{
    protected $fillable = [
        'tenant_id',
        'user_id',
        'worker_task_id',
        'provider',
        'challenge_ref',
        'encrypted_code',
        'attempt_count',
        'max_attempts',
        'status',
        'code_expires_at',
        'submitted_at',
        'resolved_at',
        'metadata_json',
    ];

    protected $hidden = [
        'encrypted_code',
    ];

    protected $casts = [
        'attempt_count' => 'integer',
        'max_attempts' => 'integer',
        'code_expires_at' => 'datetime',
        'submitted_at' => 'datetime',
        'resolved_at' => 'datetime',
        'metadata_json' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function workerTask(): BelongsTo
    {
        return $this->belongsTo(WorkerTask::class);
    }
}
