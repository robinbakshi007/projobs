<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interview_sessions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role_title', 190);
            $table->string('level', 32)->default('mid');
            $table->string('mode', 32)->default('mock');
            $table->string('status', 32)->default('active');
            $table->unsignedSmallInteger('total_questions')->default(0);
            $table->unsignedSmallInteger('answered_count')->default(0);
            $table->decimal('avg_score', 4, 2)->nullable();
            $table->json('rubric_json')->nullable();
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'user_id', 'status']);
            $table->index(['tenant_id', 'created_at']);
        });

        Schema::create('interview_questions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('interview_session_id')->constrained('interview_sessions')->cascadeOnDelete();
            $table->string('category', 64);
            $table->text('question_text');
            $table->text('expected_focus')->nullable();
            $table->unsignedSmallInteger('difficulty')->default(3);
            $table->timestamps();

            $table->index(['interview_session_id', 'category']);
        });

        Schema::create('interview_responses', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('interview_question_id')->constrained('interview_questions')->cascadeOnDelete();
            $table->text('transcript_text')->nullable();
            $table->text('ai_feedback')->nullable();
            $table->json('scores_json')->nullable();
            $table->unsignedSmallInteger('overall_score')->nullable();
            $table->timestamps();

            $table->index(['interview_question_id']);
        });

        Schema::create('resume_scans', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('original_path', 500);
            $table->string('rebuilt_path', 500)->nullable();
            $table->string('layout_hash', 128)->nullable();
            $table->boolean('layout_preserved')->default(false);
            $table->json('ats_analysis_json')->nullable();
            $table->json('diff_json')->nullable();
            $table->unsignedSmallInteger('ats_score_before')->nullable();
            $table->unsignedSmallInteger('ats_score_after')->nullable();
            $table->string('status', 32)->default('pending');
            $table->timestamps();

            $table->index(['tenant_id', 'user_id', 'status']);
        });

        Schema::create('agent_tasks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('agent_id', 128);
            $table->string('task_type', 64);
            $table->string('status', 32)->default('queued');
            $table->json('payload_json')->nullable();
            $table->json('result_json')->nullable();
            $table->string('extension_ref', 190)->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'agent_id', 'status']);
            $table->index(['tenant_id', 'task_type', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_tasks');
        Schema::dropIfExists('resume_scans');
        Schema::dropIfExists('interview_responses');
        Schema::dropIfExists('interview_questions');
        Schema::dropIfExists('interview_sessions');
    }
};
