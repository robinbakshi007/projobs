<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ResumeScan extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'original_path',
        'rebuilt_path',
        'layout_hash',
        'layout_preserved',
        'ats_analysis_json',
        'diff_json',
        'ats_score_before',
        'ats_score_after',
        'match_score',
        'ats_systems_checked',
        'formatting_issues',
        'content_suggestions',
        'grammar_issues',
        'keyword_recommendations',
        'job_description',
        'rewrite_suggestions',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'layout_preserved' => 'boolean',
            'ats_analysis_json' => 'array',
            'diff_json' => 'array',
            'ats_systems_checked' => 'array',
            'formatting_issues' => 'array',
            'content_suggestions' => 'array',
            'grammar_issues' => 'array',
            'keyword_recommendations' => 'array',
            'rewrite_suggestions' => 'array',
        ];
    }
}
