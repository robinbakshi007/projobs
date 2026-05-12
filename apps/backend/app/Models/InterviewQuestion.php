<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

class InterviewQuestion extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'interview_session_id',
        'category',
        'question_text',
        'expected_focus',
        'difficulty',
    ];

    public function response(): HasOne
    {
        return $this->hasOne(InterviewResponse::class);
    }
}
