<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ReviewIntelligenceNote extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'application_id',
        'confidence_score',
        'ai_explanation',
        'reviewer_note',
        'status',
    ];
}
