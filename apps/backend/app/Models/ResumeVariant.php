<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ResumeVariant extends Model
{
    protected $fillable = [
        'tenant_id',
        'user_id',
        'name',
        'template_style',
        'structured_resume_json',
        'design_tokens_json',
        'selected_sections_json',
        'cv_text',
        'cover_letter_text',
        'profile_photo_data',
        'is_primary',
    ];

    protected $casts = [
        'structured_resume_json' => 'array',
        'design_tokens_json' => 'array',
        'selected_sections_json' => 'array',
        'is_primary' => 'boolean',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function shareLinks(): HasMany
    {
        return $this->hasMany(ResumeShareLink::class);
    }
}
