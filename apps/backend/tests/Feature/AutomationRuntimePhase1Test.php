<?php

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkerTask;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AutomationRuntimePhase1Test extends TestCase
{
    use RefreshDatabase;

    public function test_create_submit_and_resume_otp_challenge_flow(): void
    {
        Http::fake([
            'http://localhost:8001/tasks/enqueue' => Http::response(['id' => 'worker-resume'], 201),
        ]);

        $tenant = Tenant::create([
            'slug' => 'phase1-runtime',
            'name' => 'Phase1 Runtime',
            'plan' => 'pro',
            'daily_apply_limit' => 25,
            'active' => true,
        ]);

        $user = User::create([
            'tenant_id' => $tenant->id,
            'name' => 'Owner',
            'email' => 'phase1-runtime@example.com',
            'password' => bcrypt('password-1234'),
            'timezone' => 'UTC',
            'role' => 'owner',
        ]);

        Sanctum::actingAs($user);

        $task = WorkerTask::create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'task_type' => 'apply',
            'status' => 'running',
            'payload_json' => [
                'application_ids' => [111],
                'submit_enabled' => false,
            ],
            'attempts' => 0,
        ]);

        $create = $this->withHeader('X-Tenant-Id', (string) $tenant->id)
            ->postJson('/api/v1/automation/otp-challenges', [
                'worker_task_id' => $task->id,
                'provider' => 'seek',
                'challenge_ref' => 'seek-login-code',
                'expires_in_seconds' => 300,
            ]);

        $create->assertCreated()
            ->assertJsonPath('data.status', 'waiting_for_code');

        $challengeId = (int) $create->json('data.id');

        $submit = $this->withHeader('X-Tenant-Id', (string) $tenant->id)
            ->postJson('/api/v1/automation/otp-challenges/'.$challengeId.'/submit', [
                'code' => '123456',
            ]);

        $submit->assertOk()->assertJsonPath('data.status', 'code_submitted');

        $resume = $this->withHeader('X-Tenant-Id', (string) $tenant->id)
            ->postJson('/api/v1/automation/worker-tasks/'.$task->id.'/resume', [
                'checkpoint_code' => 'otp_challenge',
                'otp_challenge_id' => $challengeId,
            ]);

        $resume->assertOk()->assertJsonPath('data.status', 'running');
    }

    public function test_session_vault_create_list_and_revoke(): void
    {
        $tenant = Tenant::create([
            'slug' => 'phase1-vault',
            'name' => 'Phase1 Vault',
            'plan' => 'pro',
            'daily_apply_limit' => 25,
            'active' => true,
        ]);

        $user = User::create([
            'tenant_id' => $tenant->id,
            'name' => 'Owner',
            'email' => 'phase1-vault@example.com',
            'password' => bcrypt('password-1234'),
            'timezone' => 'UTC',
            'role' => 'owner',
        ]);

        Sanctum::actingAs($user);

        $create = $this->withHeader('X-Tenant-Id', (string) $tenant->id)
            ->postJson('/api/v1/automation/session-vault', [
                'provider' => 'seek',
                'session_ref' => 'session-handoff-ref://seek/runtime/profile-001',
                'label' => 'Primary controlled browser session',
            ]);

        $create->assertCreated();
        $vaultId = (int) $create->json('data.id');

        $list = $this->withHeader('X-Tenant-Id', (string) $tenant->id)
            ->getJson('/api/v1/automation/session-vault');

        $list->assertOk()->assertJsonCount(1, 'data');

        $revoke = $this->withHeader('X-Tenant-Id', (string) $tenant->id)
            ->deleteJson('/api/v1/automation/session-vault/'.$vaultId);

        $revoke->assertOk();

        $this->assertDatabaseHas('browser_session_vaults', [
            'id' => $vaultId,
            'status' => 'revoked',
        ]);
    }
}
