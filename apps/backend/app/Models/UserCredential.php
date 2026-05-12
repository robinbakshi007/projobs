<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserCredential extends Model
{
    protected $fillable = [
        'tenant_id',
        'user_id',
        'provider',
        'username',
        'encrypted_secret',
        'key_version',
        'secret_checksum',
        'secret_metadata',
        'status',
        'last_validated_at',
    ];

    protected $hidden = [
        'encrypted_secret',   // never returned raw in API responses
    ];

    protected $casts = [
        'key_version' => 'integer',
        'secret_metadata'   => 'array',
        'last_validated_at' => 'datetime',
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
