<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('automation_skills', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained('tenants')->nullOnDelete();
            $table->string('provider', 32);
            $table->string('skill_code', 80);
            $table->string('version', 32)->default('1.0.0');
            $table->string('status', 24)->default('active');
            $table->json('allowed_tools_json')->nullable();
            $table->json('selector_bundle_json')->nullable();
            $table->json('runbook_json')->nullable();
            $table->json('stop_conditions_json')->nullable();
            $table->json('retry_policy_json')->nullable();
            $table->json('escalation_policy_json')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'provider', 'skill_code', 'version'], 'uniq_skill_version_scope');
            $table->index(['provider', 'skill_code', 'status'], 'idx_skill_registry_lookup');
        });

        Schema::table('automation_checkpoints', function (Blueprint $table): void {
            if (! Schema::hasColumn('automation_checkpoints', 'skill_code')) {
                $table->string('skill_code', 80)->nullable()->after('worker_task_id');
            }
            if (! Schema::hasColumn('automation_checkpoints', 'selector_version')) {
                $table->string('selector_version', 32)->nullable()->after('skill_code');
            }
            $table->index(['tenant_id', 'skill_code', 'selector_version'], 'idx_checkpoint_skill_selector');
        });
    }

    public function down(): void
    {
        Schema::table('automation_checkpoints', function (Blueprint $table): void {
            $table->dropIndex('idx_checkpoint_skill_selector');
            if (Schema::hasColumn('automation_checkpoints', 'selector_version')) {
                $table->dropColumn('selector_version');
            }
            if (Schema::hasColumn('automation_checkpoints', 'skill_code')) {
                $table->dropColumn('skill_code');
            }
        });

        Schema::dropIfExists('automation_skills');
    }
};
