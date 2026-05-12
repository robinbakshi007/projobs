<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'mfa_enabled')) {
                $table->boolean('mfa_enabled')->default(false)->after('role');
            }
            if (! Schema::hasColumn('users', 'mfa_code_hash')) {
                $table->string('mfa_code_hash', 255)->nullable()->after('mfa_enabled');
            }
            if (! Schema::hasColumn('users', 'mfa_code_expires_at')) {
                $table->timestamp('mfa_code_expires_at')->nullable()->after('mfa_code_hash');
            }
            if (! Schema::hasColumn('users', 'mfa_last_verified_at')) {
                $table->timestamp('mfa_last_verified_at')->nullable()->after('mfa_code_expires_at');
            }
        });

        Schema::create('onboarding_milestones', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('code', 80);
            $table->string('label', 190);
            $table->string('status', 32)->default('todo');
            $table->unsignedTinyInteger('progress_percent')->default(0);
            $table->json('metadata_json')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'user_id', 'code'], 'uniq_milestone_scope');
            $table->index(['tenant_id', 'user_id', 'status']);
        });

        Schema::create('security_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event_type', 80);
            $table->string('severity', 16)->default('info');
            $table->string('ip_address', 64)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->json('metadata_json')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['tenant_id', 'event_type', 'created_at']);
            $table->index(['tenant_id', 'severity', 'created_at']);
        });

        Schema::create('review_intelligence_notes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('application_id')->nullable()->constrained('applications')->nullOnDelete();
            $table->unsignedTinyInteger('confidence_score')->nullable();
            $table->text('ai_explanation')->nullable();
            $table->text('reviewer_note')->nullable();
            $table->string('status', 32)->default('open');
            $table->timestamps();

            $table->index(['tenant_id', 'user_id', 'status']);
        });

        Schema::create('automation_checkpoints', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('worker_task_id')->nullable()->constrained('worker_tasks')->nullOnDelete();
            $table->string('checkpoint_code', 80);
            $table->string('status', 32)->default('pending');
            $table->json('details_json')->nullable();
            $table->timestamp('checkpoint_at')->useCurrent();
            $table->timestamps();

            $table->index(['tenant_id', 'user_id', 'checkpoint_code']);
            $table->index(['tenant_id', 'status', 'checkpoint_at']);
        });

        Schema::create('sms_messages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained('tenants')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('provider', 32);
            $table->string('to_number', 64);
            $table->string('status', 32)->default('queued');
            $table->string('external_id', 190)->nullable();
            $table->text('body');
            $table->json('metadata_json')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'provider', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sms_messages');
        Schema::dropIfExists('automation_checkpoints');
        Schema::dropIfExists('review_intelligence_notes');
        Schema::dropIfExists('security_events');
        Schema::dropIfExists('onboarding_milestones');

        Schema::table('users', function (Blueprint $table): void {
            foreach (['mfa_last_verified_at', 'mfa_code_expires_at', 'mfa_code_hash', 'mfa_enabled'] as $column) {
                if (Schema::hasColumn('users', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
