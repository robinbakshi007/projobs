<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Multi-tenant layer.
 *
 * Strategy: single-database tenancy — every domain table carries a `tenant_id`
 * column.  A row in `tenants` acts as the SaaS customer record (e.g. a company,
 * a recruiting agency, or an individual premium user).  Laravel resolves the
 * current tenant from the `X-Tenant-Id` request header via TenantMiddleware.
 *
 * All existing platform tables gain a nullable tenant_id so existing dev data
 * keeps working.  In production every row MUST have a tenant.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ------------------------------------------------------------------ //
        //  Core tenant registry                                               //
        // ------------------------------------------------------------------ //
        Schema::create('tenants', function (Blueprint $table): void {
            $table->id();
            $table->string('slug', 64)->unique();          // URL-safe identifier
            $table->string('name', 191);
            $table->string('plan', 32)->default('starter'); // starter|pro|enterprise
            $table->unsignedInteger('daily_apply_limit')->default(10);
            $table->json('feature_flags')->nullable();     // per-tenant toggles
            $table->json('manifest')->nullable();           // manifest.js-style config blob
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        // ------------------------------------------------------------------ //
        //  Add tenant_id to every domain table                               //
        // ------------------------------------------------------------------ //
        $tables = [
            'user_profiles',
            'user_credentials',
            'search_configs',
            'scrape_runs',
            'job_matches',
            'generated_documents',
            'tailoring_runs',
            'application_quotas',
            'application_sessions',
            'applications',
            'application_steps',
            'worker_tasks',
            'audit_events',
        ];

        foreach ($tables as $tbl) {
            Schema::table($tbl, function (Blueprint $table) use ($tbl): void {
                $table->foreignId('tenant_id')
                    ->nullable()
                    ->after('id')
                    ->constrained('tenants')
                    ->nullOnDelete();

                $table->index('tenant_id', "idx_{$tbl}_tenant");
            });
        }

        // worker_tasks also needs user_id for per-user isolation
        Schema::table('worker_tasks', function (Blueprint $table): void {
            $table->foreignId('user_id')
                ->nullable()
                ->after('tenant_id')
                ->constrained()
                ->nullOnDelete();
        });

        // ------------------------------------------------------------------ //
        //  Seed a default tenant so existing tests keep passing              //
        // ------------------------------------------------------------------ //
        \DB::table('tenants')->insert([
            'id'               => 1,
            'slug'             => 'default',
            'name'             => 'Default Tenant',
            'plan'             => 'starter',
            'daily_apply_limit'=> 10,
            'active'           => 1,
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);
    }

    public function down(): void
    {
        $tables = [
            'audit_events',
            'worker_tasks',
            'application_steps',
            'applications',
            'application_sessions',
            'application_quotas',
            'tailoring_runs',
            'generated_documents',
            'job_matches',
            'scrape_runs',
            'search_configs',
            'user_credentials',
            'user_profiles',
        ];

        foreach ($tables as $tbl) {
            Schema::table($tbl, function (Blueprint $table) use ($tbl): void {
                $table->dropIndex("idx_{$tbl}_tenant");
                $table->dropConstrainedForeignId('tenant_id');
            });
        }

        Schema::table('worker_tasks', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('user_id');
        });

        Schema::dropIfExists('tenants');
    }
};
