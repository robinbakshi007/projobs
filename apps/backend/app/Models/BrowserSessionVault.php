<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BrowserSessionVault extends Model
{
    protected $fillable = [
        'tenant_id',
        'user_id',
        'provider',
        'label',
        'encrypted_session_ref',
        'session_checksum',
        'status',
        'expires_at',
        'revoked_at',
        'last_used_at',
        'metadata_json',
    ];

    protected $hidden = [
        'encrypted_session_ref',
        'session_checksum',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'revoked_at' => 'datetime',
        'last_used_at' => 'datetime',
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
}
