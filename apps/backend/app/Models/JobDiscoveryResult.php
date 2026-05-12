<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JobDiscoveryResult extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'job_discovery_preference_id',
        'source',
        'external_id',
        'title',
        'company',
        'location_text',
        'description',
        'apply_url',
        'salary_text',
        'posted_at',
        'match_score',
        'preference_score_10',
        'metadata_json',
        'score_breakdown_json',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'metadata_json' => 'array',
            'score_breakdown_json' => 'array',
            'posted_at' => 'datetime',
            'match_score' => 'decimal:2',
            'preference_score_10' => 'decimal:2',
        ];
    }

    public function preference(): BelongsTo
    {
        return $this->belongsTo(JobDiscoveryPreference::class, 'job_discovery_preference_id');
    }
}
