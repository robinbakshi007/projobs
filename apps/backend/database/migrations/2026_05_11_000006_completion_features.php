<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'email_verification_token')) {
                $table->string('email_verification_token', 128)->nullable()->after('email_verified_at');
            }
        });

        Schema::table('user_credentials', function (Blueprint $table): void {
            if (! Schema::hasColumn('user_credentials', 'key_version')) {
                $table->unsignedInteger('key_version')->default(1)->after('encrypted_secret');
            }
            if (! Schema::hasColumn('user_credentials', 'secret_checksum')) {
                $table->string('secret_checksum', 128)->nullable()->after('key_version');
            }
        });

        Schema::table('job_listings', function (Blueprint $table): void {
            if (! Schema::hasColumn('job_listings', 'schema_version')) {
                $table->string('schema_version', 16)->default('1.0')->after('source');
                $table->index(['schema_version']);
            }
        });

        Schema::table('worker_tasks', function (Blueprint $table): void {
            if (! Schema::hasColumn('worker_tasks', 'idempotency_key')) {
                $table->string('idempotency_key', 190)->nullable()->after('task_type');
                $table->index(['tenant_id', 'user_id', 'idempotency_key'], 'idx_worker_task_idem');
            }
        });

        Schema::create('worker_task_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained('tenants')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('worker_task_id')->constrained('worker_tasks')->cascadeOnDelete();
            $table->string('event_type', 64);
            $table->json('metadata_json')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['worker_task_id', 'created_at']);
            $table->index(['tenant_id', 'event_type']);
        });

        Schema::create('daily_analytics', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('date_key');
            $table->unsignedInteger('sessions_started')->default(0);
            $table->unsignedInteger('applications_approved')->default(0);
            $table->unsignedInteger('applications_submitted')->default(0);
            $table->unsignedInteger('applications_failed')->default(0);
            $table->unsignedInteger('jobs_scraped')->default(0);
            $table->decimal('avg_ats_score', 5, 2)->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'user_id', 'date_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_analytics');
        Schema::dropIfExists('worker_task_events');

        Schema::table('worker_tasks', function (Blueprint $table): void {
            if (Schema::hasColumn('worker_tasks', 'idempotency_key')) {
                $table->dropIndex('idx_worker_task_idem');
                $table->dropColumn('idempotency_key');
            }
        });

        Schema::table('job_listings', function (Blueprint $table): void {
            if (Schema::hasColumn('job_listings', 'schema_version')) {
                $table->dropIndex(['schema_version']);
                $table->dropColumn('schema_version');
            }
        });

        Schema::table('user_credentials', function (Blueprint $table): void {
            if (Schema::hasColumn('user_credentials', 'secret_checksum')) {
                $table->dropColumn('secret_checksum');
            }
            if (Schema::hasColumn('user_credentials', 'key_version')) {
                $table->dropColumn('key_version');
            }
        });

        Schema::table('users', function (Blueprint $table): void {
            if (Schema::hasColumn('users', 'email_verification_token')) {
                $table->dropColumn('email_verification_token');
            }
        });
    }
};
