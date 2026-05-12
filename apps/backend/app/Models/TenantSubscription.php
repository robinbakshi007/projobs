<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TenantSubscription extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'plan_code',
        'status',
        'stripe_customer_id',
        'stripe_subscription_id',
        'stripe_checkout_session_id',
        'amount_cents',
        'currency',
        'trial_ends_at',
        'current_period_start',
        'current_period_end',
        'metadata_json',
    ];

    protected function casts(): array
    {
        return [
            'trial_ends_at' => 'datetime',
            'current_period_start' => 'datetime',
            'current_period_end' => 'datetime',
            'metadata_json' => 'array',
        ];
    }
}
