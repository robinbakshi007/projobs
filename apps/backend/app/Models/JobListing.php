<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class JobListing extends Model
{
    use HasFactory;

    protected $fillable = [
        'source',
        'schema_version',
        'external_job_id',
        'source_url',
        'title',
        'company',
        'location_text',
        'remote_flag',
        'job_type_text',
        'posted_at',
        'description_text',
        'salary_text',
        'raw_payload_json',
        'first_seen_at',
        'last_seen_at',
    ];

    protected function casts(): array
    {
        return [
            'remote_flag' => 'boolean',
            'raw_payload_json' => 'array',
            'schema_version' => 'string',
            'posted_at' => 'datetime',
            'first_seen_at' => 'datetime',
            'last_seen_at' => 'datetime',
        ];
    }
}
