<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('resume_scans', function (Blueprint $table): void {
            if (!Schema::hasColumn('resume_scans', 'match_score')) {
                $table->unsignedSmallInteger('match_score')->nullable()->after('ats_score_after');
            }
            if (!Schema::hasColumn('resume_scans', 'ats_systems_checked')) {
                $table->json('ats_systems_checked')->nullable()->after('match_score');
            }
            if (!Schema::hasColumn('resume_scans', 'formatting_issues')) {
                $table->json('formatting_issues')->nullable()->after('ats_systems_checked');
            }
            if (!Schema::hasColumn('resume_scans', 'content_suggestions')) {
                $table->json('content_suggestions')->nullable()->after('formatting_issues');
            }
            if (!Schema::hasColumn('resume_scans', 'grammar_issues')) {
                $table->json('grammar_issues')->nullable()->after('content_suggestions');
            }
            if (!Schema::hasColumn('resume_scans', 'keyword_recommendations')) {
                $table->json('keyword_recommendations')->nullable()->after('grammar_issues');
            }
            if (!Schema::hasColumn('resume_scans', 'job_description')) {
                $table->text('job_description')->nullable()->after('original_path');
            }
            if (!Schema::hasColumn('resume_scans', 'rewrite_suggestions')) {
                $table->json('rewrite_suggestions')->nullable()->after('keyword_recommendations');
            }
        });

        Schema::create('job_discovery_preferences', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role_title', 190)->nullable();
            $table->string('location', 120)->nullable();
            $table->string('work_type', 32)->nullable(); // remote, onsite, hybrid
            $table->json('skills')->nullable();
            $table->json('industries')->nullable();
            $table->unsignedInteger('min_salary')->nullable();
            $table->unsignedInteger('max_salary')->nullable();
            $table->string('currency', 8)->default('USD');
            $table->string('experience_level', 32)->nullable(); // entry, mid, senior, lead
            $table->timestamps();

            $table->index(['tenant_id', 'user_id']);
        });

        Schema::create('job_discovery_results', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('job_discovery_preference_id')->constrained('job_discovery_preferences')->cascadeOnDelete();
            $table->string('source', 64)->default('google_grounding');
            $table->string('external_id', 190)->nullable();
            $table->string('title', 190);
            $table->string('company', 120);
            $table->string('location_text', 120)->nullable();
            $table->text('description')->nullable();
            $table->string('apply_url', 500)->nullable();
            $table->string('salary_text', 120)->nullable();
            $table->timestamp('posted_at')->nullable();
            $table->decimal('match_score', 5, 2)->nullable();
            $table->json('metadata_json')->nullable();
            $table->string('status', 32)->default('new'); // new, viewed, saved, applied
            $table->timestamps();

            $table->index(['tenant_id', 'user_id', 'status']);
            $table->index(['job_discovery_preference_id', 'match_score']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_discovery_results');
        Schema::dropIfExists('job_discovery_preferences');

        Schema::table('resume_scans', function (Blueprint $table): void {
            foreach ([
                'rewrite_suggestions', 'keyword_recommendations', 'grammar_issues',
                'content_suggestions', 'formatting_issues', 'ats_systems_checked',
                'match_score', 'job_description'
            ] as $column) {
                if (Schema::hasColumn('resume_scans', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
