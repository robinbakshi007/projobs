<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InterviewResponse extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'interview_question_id',
        'transcript_text',
        'ai_feedback',
        'scores_json',
        'overall_score',
    ];

    protected function casts(): array
    {
        return [
            'scores_json' => 'array',
        ];
    }
}
