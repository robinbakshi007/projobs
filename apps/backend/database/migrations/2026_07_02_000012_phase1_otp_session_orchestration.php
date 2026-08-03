<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('otp_challenges', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('worker_task_id')->nullable()->constrained('worker_tasks')->nullOnDelete();
            $table->string('provider', 32);
            $table->string('challenge_ref', 190)->nullable();
            $table->longText('encrypted_code')->nullable();
            $table->unsignedTinyInteger('attempt_count')->default(0);
            $table->unsignedTinyInteger('max_attempts')->default(3);
            $table->string('status', 32)->default('waiting_for_code');
            $table->timestamp('code_expires_at')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->json('metadata_json')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'user_id', 'status'], 'idx_otp_scope_status');
            $table->index(['worker_task_id', 'status'], 'idx_otp_task_status');
        });

        Schema::create('browser_session_vaults', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 32);
            $table->string('label', 120)->nullable();
            $table->longText('encrypted_session_ref');
            $table->string('session_checksum', 64);
            $table->string('status', 24)->default('active');
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->json('metadata_json')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'user_id', 'provider', 'status'], 'idx_session_vault_scope');
        });

        Schema::table('worker_tasks', function (Blueprint $table): void {
            if (! Schema::hasColumn('worker_tasks', 'checkpoint_code')) {
                $table->string('checkpoint_code', 80)->nullable()->after('status');
            }
            if (! Schema::hasColumn('worker_tasks', 'state_reason')) {
                $table->string('state_reason', 190)->nullable()->after('checkpoint_code');
            }
            if (! Schema::hasColumn('worker_tasks', 'retry_policy_json')) {
                $table->json('retry_policy_json')->nullable()->after('payload_json');
            }
            if (! Schema::hasColumn('worker_tasks', 'runbook_version')) {
                $table->string('runbook_version', 32)->nullable()->after('task_type');
            }

            $table->index(['tenant_id', 'user_id', 'status', 'checkpoint_code'], 'idx_worker_task_phase1_status');
        });
    }

    public function down(): void
    {
        Schema::table('worker_tasks', function (Blueprint $table): void {
            $table->dropIndex('idx_worker_task_phase1_status');

            foreach (['runbook_version', 'retry_policy_json', 'state_reason', 'checkpoint_code'] as $column) {
                if (Schema::hasColumn('worker_tasks', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::dropIfExists('browser_session_vaults');
        Schema::dropIfExists('otp_challenges');
    }
};
