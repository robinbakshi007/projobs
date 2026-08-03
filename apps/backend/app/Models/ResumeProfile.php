<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ResumeProfile extends Model
{
    protected $fillable = [
        'tenant_id',
        'user_id',
        'name',
        'target_title',
        'template_style',
        'structured_resume_json',
        'design_tokens_json',
        'selected_sections_json',
        'cv_text',
        'cover_letter_text',
        'profile_photo_data',
    ];

    protected $casts = [
        'structured_resume_json' => 'array',
        'design_tokens_json' => 'array',
        'selected_sections_json' => 'array',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
