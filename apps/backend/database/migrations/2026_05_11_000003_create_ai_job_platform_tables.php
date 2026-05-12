<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'timezone')) {
                $table->string('timezone', 64)->default('UTC')->after('email');
            }
        });

        Schema::create('user_profiles', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('phone', 30)->nullable();
            $table->string('linkedin_url')->nullable();
            $table->string('seek_profile_url')->nullable();
            $table->string('default_location', 120)->nullable();
            $table->json('default_job_types_json')->nullable();
            $table->timestamps();
        });

        Schema::create('user_credentials', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 32);
            $table->string('username', 190)->nullable();
            $table->longText('encrypted_secret');
            $table->json('secret_metadata')->nullable();
            $table->string('status', 24)->default('active');
            $table->timestamp('last_validated_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'provider']);
        });

        Schema::create('search_configs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('keywords', 255);
            $table->string('location', 120)->nullable();
            $table->string('job_type', 32)->nullable();
            $table->string('remote_mode', 32)->default('any');
            $table->unsignedInteger('results_target')->default(50);
            $table->boolean('active_flag')->default(true);
            $table->timestamps();
        });

        Schema::create('scrape_runs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('search_config_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 24)->default('queued');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->text('error_summary')->nullable();
            $table->json('source_breakdown_json')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('job_listings', function (Blueprint $table): void {
            $table->id();
            $table->string('source', 32);
            $table->string('external_job_id', 190);
            $table->string('source_url')->nullable();
            $table->string('title', 255);
            $table->string('company', 255)->nullable();
            $table->string('location_text', 190)->nullable();
            $table->boolean('remote_flag')->default(false);
            $table->string('job_type_text', 64)->nullable();
            $table->timestamp('posted_at')->nullable();
            $table->longText('description_text')->nullable();
            $table->string('salary_text', 120)->nullable();
            $table->json('raw_payload_json')->nullable();
            $table->timestamp('first_seen_at')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();

            $table->unique(['source', 'external_job_id']);
            $table->index(['source', 'posted_at']);
        });

        Schema::create('job_snapshots', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('job_listing_id')->constrained('job_listings')->cascadeOnDelete();
            $table->foreignId('scrape_run_id')->nullable()->constrained('scrape_runs')->nullOnDelete();
            $table->string('snapshot_hash', 128);
            $table->longText('description_text')->nullable();
            $table->json('raw_payload_json')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('job_matches', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('job_listing_id')->constrained('job_listings')->cascadeOnDelete();
            $table->decimal('score_numeric', 5, 2)->default(0);
            $table->json('missing_skills_json')->nullable();
            $table->json('matched_skills_json')->nullable();
            $table->text('rationale_text')->nullable();
            $table->timestamp('scored_at')->useCurrent();

            $table->unique(['user_id', 'job_listing_id']);
        });

        Schema::create('generated_documents', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('job_listing_id')->constrained('job_listings')->cascadeOnDelete();
            $table->string('type', 32);
            $table->string('file_path');
            $table->string('file_hash', 128)->nullable();
            $table->string('generator_version', 64)->nullable();
            $table->string('prompt_version', 64)->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('tailoring_runs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('job_listing_id')->constrained('job_listings')->cascadeOnDelete();
            $table->string('status', 24)->default('queued');
            $table->text('summary_before')->nullable();
            $table->text('summary_after')->nullable();
            $table->decimal('ats_score_before', 5, 2)->nullable();
            $table->decimal('ats_score_after', 5, 2)->nullable();
            $table->text('error_details')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
        });

        Schema::create('application_quotas', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('date_key');
            $table->unsignedInteger('max_applications')->default(10);
            $table->unsignedInteger('applied_count')->default(0);
            $table->unsignedInteger('reserved_count')->default(0);
            $table->timestamp('updated_at')->useCurrent();

            $table->unique(['user_id', 'date_key']);
        });

        Schema::create('application_sessions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('requested_max');
            $table->string('mode', 24);
            $table->string('status', 24)->default('queued');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->string('stop_reason', 64)->nullable();
            $table->timestamps();
        });

        Schema::create('applications', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('job_listing_id')->constrained('job_listings')->cascadeOnDelete();
            $table->foreignId('session_id')->nullable()->constrained('application_sessions')->nullOnDelete();
            $table->string('status', 24)->default('pending');
            $table->string('failure_code', 64)->nullable();
            $table->text('failure_detail')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'job_listing_id']);
        });

        Schema::create('application_steps', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('application_id')->constrained('applications')->cascadeOnDelete();
            $table->string('step_name', 80);
            $table->string('status', 24);
            $table->string('evidence_path')->nullable();
            $table->json('metadata_json')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('worker_tasks', function (Blueprint $table): void {
            $table->id();
            $table->string('task_type', 24);
            $table->unsignedBigInteger('foreign_ref_id')->nullable();
            $table->string('status', 24)->default('queued');
            $table->unsignedInteger('attempts')->default(0);
            $table->timestamp('next_retry_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->index(['task_type', 'status']);
        });

        Schema::create('audit_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('actor_type', 32);
            $table->string('action', 64);
            $table->string('entity_type', 64);
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->json('metadata_json')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['entity_type', 'entity_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_events');
        Schema::dropIfExists('worker_tasks');
        Schema::dropIfExists('application_steps');
        Schema::dropIfExists('applications');
        Schema::dropIfExists('application_sessions');
        Schema::dropIfExists('application_quotas');
        Schema::dropIfExists('tailoring_runs');
        Schema::dropIfExists('generated_documents');
        Schema::dropIfExists('job_matches');
        Schema::dropIfExists('job_snapshots');
        Schema::dropIfExists('job_listings');
        Schema::dropIfExists('scrape_runs');
        Schema::dropIfExists('search_configs');
        Schema::dropIfExists('user_credentials');
        Schema::dropIfExists('user_profiles');

        Schema::table('users', function (Blueprint $table): void {
            if (Schema::hasColumn('users', 'timezone')) {
                $table->dropColumn('timezone');
            }
        });
    }
};
