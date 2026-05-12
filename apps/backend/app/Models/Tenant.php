<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Tenant extends Model
{
    protected $fillable = [
        'slug',
        'name',
        'plan',
        'daily_apply_limit',
        'feature_flags',
        'manifest',
        'active',
    ];

    protected $casts = [
        'feature_flags' => 'array',
        'manifest'       => 'array',
        'active'         => 'boolean',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /** Check a feature flag, with optional default. */
    public function hasFeature(string $key, mixed $default = false): mixed
    {
        return $this->feature_flags[$key] ?? $default;
    }

    /** Read a manifest key (manifest.js-style per-tenant config). */
    public function manifest(string $key, mixed $default = null): mixed
    {
        return $this->manifest[$key] ?? $default;
    }
}
