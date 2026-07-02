<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\JobListing;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkerTask;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AutoSubmitPolicyAndKillSwitchTest extends TestCase
{
    use RefreshDatabase;

    public function test_tenant_admin_can_toggle_auto_submit_policy(): void
    {
        config(['services.worker.auto_submit_enabled' => true]);

        $tenant = Tenant::create([
            'slug' => 'tenant-policy',
            'name' => 'Tenant Policy',
            'plan' => 'pro',
            'daily_apply_limit' => 25,
            'active' => true,
            'feature_flags' => ['auto_submit_enabled' => false],
        ]);

        $user = User::create([
            'tenant_id' => $tenant->id,
            'name' => 'Owner',
            'email' => 'owner-policy@example.com',
            'password' => bcrypt('password-1234'),
            'timezone' => 'UTC',
            'role' => 'owner',
        ]);

        Sanctum::actingAs($user);

        $show = $this->withHeader('X-Tenant-Id', (string) $tenant->id)
            ->getJson('/api/v1/automation/auto-submit-policy');

        $show->assertOk()
            ->assertJsonPath('global_enabled', true)
            ->assertJsonPath('tenant_enabled', false)
            ->assertJsonPath('effective_enabled', false);

        $update = $this->withHeader('X-Tenant-Id', (string) $tenant->id)
            ->putJson('/api/v1/automation/auto-submit-policy', ['enabled' => true]);

        $update->assertOk()
            ->assertJsonPath('tenant_enabled', true)
            ->assertJsonPath('effective_enabled', true);
    }

    public function test_member_role_cannot_toggle_auto_submit_policy(): void
    {
        $tenant = Tenant::create([
            'slug' => 'tenant-member',
            'name' => 'Tenant Member',
            'plan' => 'starter',
            'daily_apply_limit' => 10,
            'active' => true,
        ]);

        $user = User::create([
            'tenant_id' => $tenant->id,
            'name' => 'Member',
            'email' => 'member-policy@example.com',
            'password' => bcrypt('password-1234'),
            'timezone' => 'UTC',
            'role' => 'member',
        ]);

        Sanctum::actingAs($user);

        $response = $this->withHeader('X-Tenant-Id', (string) $tenant->id)
            ->putJson('/api/v1/automation/auto-submit-policy', ['enabled' => true]);

        $response->assertStatus(403);
    }

    public function test_review_approve_respects_kill_switch_and_does_not_enqueue(): void
    {
        config(['services.worker.auto_submit_enabled' => false]);

        $tenant = Tenant::create([
            'slug' => 'tenant-kill-switch',
            'name' => 'Tenant Kill Switch',
            'plan' => 'pro',
            'daily_apply_limit' => 25,
            'active' => true,
            'feature_flags' => ['auto_submit_enabled' => true],
        ]);

        $user = User::create([
            'tenant_id' => $tenant->id,
            'name' => 'Reviewer',
            'email' => 'review-kill-switch@example.com',
            'password' => bcrypt('password-1234'),
            'timezone' => 'UTC',
            'role' => 'owner',
        ]);

        Sanctum::actingAs($user);

        $job = JobListing::create([
            'source' => 'seek',
            'external_job_id' => 'seek-kill-switch',
            'title' => 'Automation Engineer',
        ]);

        $application = Application::create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'job_listing_id' => $job->id,
            'status' => 'pending_review',
        ]);

        $response = $this->withHeader('X-Tenant-Id', (string) $tenant->id)
            ->postJson('/api/v1/applications/'.$application->id.'/approve');

        $response->assertOk()
            ->assertJsonPath('worker_task_id', null)
            ->assertJsonPath('auto_submit_enabled', false);

        $this->assertDatabaseCount('worker_tasks', 0);
    }

    public function test_application_session_apply_task_contains_application_ids_when_enabled(): void
    {
        config(['services.worker.auto_submit_enabled' => true]);

        Http::fake([
            'http://localhost:8001/tasks/enqueue' => Http::response(['id' => 'worker-1'], 201),
        ]);

        $tenant = Tenant::create([
            'slug' => 'tenant-apply-contract',
            'name' => 'Tenant Apply Contract',
            'plan' => 'pro',
            'daily_apply_limit' => 25,
            'active' => true,
            'feature_flags' => ['auto_submit_enabled' => true],
        ]);

        $user = User::create([
            'tenant_id' => $tenant->id,
            'name' => 'Apply Owner',
            'email' => 'apply-contract@example.com',
            'password' => bcrypt('password-1234'),
            'timezone' => 'UTC',
            'role' => 'owner',
        ]);

        Sanctum::actingAs($user);

        $jobA = JobListing::create([
            'source' => 'seek',
            'external_job_id' => 'seek-contract-1',
            'title' => 'Role A',
        ]);

        $jobB = JobListing::create([
            'source' => 'seek',
            'external_job_id' => 'seek-contract-2',
            'title' => 'Role B',
        ]);

        $response = $this->withHeader('X-Tenant-Id', (string) $tenant->id)
            ->postJson('/api/v1/application-sessions/start', [
                'user_selected_job_ids' => [$jobA->id, $jobB->id],
                'max_jobs' => 2,
                'mode' => 'balanced',
            ]);

        $response->assertCreated()
            ->assertJsonPath('accepted_count', 2)
            ->assertJsonPath('auto_submit_enabled', true);

        $task = WorkerTask::query()->latest('id')->first();

        $this->assertNotNull($task);
        $this->assertSame('apply', $task->task_type);
        $this->assertIsArray($task->payload_json['application_ids'] ?? null);
        $this->assertCount(2, $task->payload_json['application_ids'] ?? []);
    }
}
