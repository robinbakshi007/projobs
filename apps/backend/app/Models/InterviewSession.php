<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InterviewSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'role_title',
        'level',
        'mode',
        'status',
        'total_questions',
        'answered_count',
        'avg_score',
        'rubric_json',
        'started_at',
        'ended_at',
    ];

    protected function casts(): array
    {
        return [
            'rubric_json' => 'array',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'avg_score' => 'decimal:2',
        ];
    }

    public function questions(): HasMany
    {
        return $this->hasMany(InterviewQuestion::class);
    }
}
