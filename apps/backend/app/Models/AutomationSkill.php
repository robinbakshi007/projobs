<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AutomationSkill extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'provider',
        'skill_code',
        'version',
        'status',
        'allowed_tools_json',
        'selector_bundle_json',
        'runbook_json',
        'stop_conditions_json',
        'retry_policy_json',
        'escalation_policy_json',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'allowed_tools_json' => 'array',
            'selector_bundle_json' => 'array',
            'runbook_json' => 'array',
            'stop_conditions_json' => 'array',
            'retry_policy_json' => 'array',
            'escalation_policy_json' => 'array',
            'published_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
