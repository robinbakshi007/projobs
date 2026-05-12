<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TailoringRun extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'job_listing_id',
        'status',
        'summary_before',
        'summary_after',
        'ats_score_before',
        'ats_score_after',
        'error_details',
        'started_at',
        'ended_at',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        'ats_score_before' => 'float',
        'ats_score_after' => 'float',
    ];
}
