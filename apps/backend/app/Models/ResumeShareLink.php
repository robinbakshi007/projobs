<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ResumeShareLink extends Model
{
    protected $fillable = [
        'tenant_id',
        'user_id',
        'resume_variant_id',
        'token',
        'title',
        'template_style',
        'structured_resume_json',
        'design_tokens_json',
        'selected_sections_json',
        'cv_text',
        'cover_letter_text',
        'profile_photo_data',
        'expires_at',
        'is_public',
        'view_count',
    ];

    protected $casts = [
        'structured_resume_json' => 'array',
        'design_tokens_json' => 'array',
        'selected_sections_json' => 'array',
        'expires_at' => 'datetime',
        'is_public' => 'boolean',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ResumeVariant::class, 'resume_variant_id');
    }
}
