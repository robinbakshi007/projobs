<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkerTask;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkerCheckpointCallbackTest extends TestCase
{
    use RefreshDatabase;

    public function test_checkpoint_status_updates_worker_task_to_waiting_for_code(): void
    {
        config([
            'services.worker.callback_key' => 'local-worker',
            'services.worker.callback_secret' => 'test-secret',
        ]);

        $tenant = Tenant::create([
            'slug' => 'callback-tenant',
            'name' => 'Callback Tenant',
            'plan' => 'pro',
            'daily_apply_limit' => 25,
            'active' => true,
        ]);

        $user = User::create([
            'tenant_id' => $tenant->id,
            'name' => 'Callback User',
            'email' => 'callback-user@example.com',
            'password' => bcrypt('password-1234'),
            'timezone' => 'UTC',
            'role' => 'owner',
        ]);

        $task = WorkerTask::create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'task_type' => 'apply',
            'status' => 'running',
            'payload_json' => ['application_ids' => [1]],
            'attempts' => 0,
        ]);

        $body = [
            'task_id' => $task->id,
            'status' => 'waiting_for_code',
            'checkpoint_code' => 'otp_challenge',
            'skill_code' => 'seek.apply',
            'selector_version' => '2026.07.02',
            'state_reason' => 'otp_required',
            'details' => ['provider' => 'seek'],
        ];

        $encoded = json_encode($body, JSON_UNESCAPED_SLASHES);
        $timestamp = (string) time();
        $nonce = 'nonce-abc';
        $base = $timestamp."\n".$nonce."\n".$encoded;
        $signature = hash_hmac('sha256', $base, 'test-secret');

        $response = $this->withHeaders([
            'X-Worker-Key' => 'local-worker',
            'X-Worker-Timestamp' => $timestamp,
            'X-Worker-Nonce' => $nonce,
            'X-Worker-Signature' => $signature,
        ])->postJson('/api/v1/internal/worker/checkpoint-status', $body);

        $response->assertOk();

        $this->assertDatabaseHas('worker_tasks', [
            'id' => $task->id,
            'status' => 'waiting_for_code',
            'checkpoint_code' => 'otp_challenge',
        ]);

        $this->assertDatabaseHas('automation_checkpoints', [
            'worker_task_id' => $task->id,
            'checkpoint_code' => 'otp_challenge',
            'skill_code' => 'seek.apply',
            'selector_version' => '2026.07.02',
        ]);
    }
}
