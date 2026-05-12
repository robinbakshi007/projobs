<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\JobListing;
use App\Models\TailoringRun;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthAndReviewFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_login_and_me_flow(): void
    {
        $register = $this->postJson('/api/v1/auth/register', [
            'name' => 'Robin',
            'email' => 'robin@example.com',
            'password' => 'password-1234',
            'tenant_name' => 'Robin Labs',
            'tenant_slug' => 'robin-labs',
        ]);

        $register->assertCreated()->assertJsonStructure([
            'token',
            'user',
            'tenant',
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'robin@example.com',
            'password' => 'password-1234',
            'tenant_slug' => 'robin-labs',
        ]);

        $login->assertOk()->assertJsonStructure(['token', 'user', 'tenant']);

        $token = (string) $login->json('token');
        $tenantId = (int) $login->json('tenant.id');

        $me = $this->withToken($token)
            ->withHeader('X-Tenant-Id', (string) $tenantId)
            ->getJson('/api/v1/auth/me');

        $me->assertOk()->assertJsonPath('user.email', 'robin@example.com');
    }

    public function test_review_queue_and_approve_flow(): void
    {
        $tenant = Tenant::create([
            'slug' => 'review-t',
            'name' => 'Review Tenant',
            'plan' => 'starter',
            'daily_apply_limit' => 10,
            'active' => true,
        ]);

        $user = User::create([
            'tenant_id' => $tenant->id,
            'name' => 'Reviewer',
            'email' => 'reviewer@example.com',
            'password' => bcrypt('password-1234'),
            'timezone' => 'UTC',
            'role' => 'owner',
        ]);

        Sanctum::actingAs($user);

        $job = JobListing::create([
            'source' => 'seek',
            'external_job_id' => 'seek-99',
            'title' => 'Backend Engineer',
            'company' => 'Acme',
            'source_url' => 'https://seek.com.au/job/99',
            'description_text' => 'Laravel and Python',
        ]);

        $app = Application::create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'job_listing_id' => $job->id,
            'status' => 'pending_review',
        ]);

        TailoringRun::create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'job_listing_id' => $job->id,
            'status' => 'succeeded',
            'summary_before' => 'before',
            'summary_after' => 'after',
            'ats_score_before' => 55,
            'ats_score_after' => 80,
        ]);

        $queue = $this->withHeader('X-Tenant-Id', (string) $tenant->id)
            ->getJson('/api/v1/review-queue');

        $queue->assertOk()->assertJsonCount(1, 'data');

        $approve = $this->withHeader('X-Tenant-Id', (string) $tenant->id)
            ->postJson('/api/v1/applications/'.$app->id.'/approve');

        $approve->assertOk()->assertJsonStructure(['worker_task_id']);

        $this->assertDatabaseHas('applications', [
            'id' => $app->id,
            'status' => 'approved',
        ]);
    }
}
