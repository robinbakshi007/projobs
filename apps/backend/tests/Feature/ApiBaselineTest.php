<?php

namespace Tests\Feature;

use App\Models\ApplicationSession;
use App\Models\JobListing;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ApiBaselineTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::create([
            'slug' => 't-test',
            'name' => 'Test Tenant',
            'plan' => 'pro',
            'daily_apply_limit' => 10,
            'active' => true,
        ]);

        $user = User::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => bcrypt('password-1234'),
            'timezone' => 'UTC',
            'role' => 'owner',
        ]);

        Sanctum::actingAs($user);
    }

    public function test_health_endpoint_returns_ok(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response
            ->assertOk()
            ->assertJson([
                'status' => 'ok',
                'service' => 'backend-api',
            ]);
    }

    public function test_jobs_endpoint_returns_paginated_list(): void
    {
        JobListing::create([
            'source' => 'seek',
            'external_job_id' => 'seek-1',
            'title' => 'Backend Engineer',
        ]);

        $response = $this->withHeader('X-Tenant-Id', (string) $this->tenant->id)
            ->getJson('/api/v1/jobs');

        $response
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'current_page',
                'last_page',
                'per_page',
                'total',
            ]);
    }

    public function test_quota_today_is_created_for_default_user(): void
    {
        $response = $this->withHeader('X-Tenant-Id', (string) $this->tenant->id)
            ->getJson('/api/v1/quotas/today');

        $response
            ->assertOk()
            ->assertJsonStructure([
                'id',
                'user_id',
                'date_key',
                'max_applications',
                'applied_count',
                'reserved_count',
            ]);
    }

    public function test_application_session_start_creates_session(): void
    {
        $job = JobListing::create([
            'source' => 'seek',
            'external_job_id' => 'seek-2',
            'title' => 'Automation Engineer',
        ]);

        $response = $this->withHeader('X-Tenant-Id', (string) $this->tenant->id)
            ->postJson('/api/v1/application-sessions/start', [
            'user_selected_job_ids' => [$job->id],
            'max_jobs' => 1,
            'mode' => 'aggressive',
            'dry_run' => true,
        ]);

        $response
            ->assertCreated()
            ->assertJsonStructure([
                'session_id',
                'accepted_count',
                'rejected_count',
                'quota_remaining',
            ]);

        $this->assertDatabaseCount('application_sessions', 1);
    }

    public function test_application_session_can_be_stopped(): void
    {
        $this->withHeader('X-Tenant-Id', (string) $this->tenant->id)
            ->getJson('/api/v1/quotas/today')
            ->assertOk();

        $session = ApplicationSession::create([
            'tenant_id' => $this->tenant->id,
            'user_id' => 1,
            'requested_max' => 2,
            'mode' => 'aggressive',
            'status' => 'running',
            'started_at' => now(),
        ]);

        $response = $this->withHeader('X-Tenant-Id', (string) $this->tenant->id)
            ->postJson('/api/v1/application-sessions/'.$session->id.'/stop');

        $response
            ->assertOk()
            ->assertJsonPath('session.status', 'stopped');
    }
}
