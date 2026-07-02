<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesApiUser;
use App\Http\Controllers\Controller;
use App\Models\AutomationCheckpoint;
use App\Models\BrowserSessionVault;
use App\Models\OtpChallenge;
use App\Models\WorkerTask;
use App\Services\EncryptionService;
use App\Services\WorkerClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AutomationRuntimeController extends Controller
{
    use ResolvesApiUser;

    public function __construct(
        private readonly EncryptionService $encryption,
        private readonly WorkerClient $workerClient,
    ) {}

    public function otpChallenges(Request $request): JsonResponse
    {
        $status = (string) $request->query('status', '');

        $query = OtpChallenge::query()
            ->where('tenant_id', $this->currentTenantId())
            ->where('user_id', $this->resolveApiUserId())
            ->orderByDesc('id');

        if ($status !== '') {
            $query->where('status', $status);
        }

        return response()->json(['data' => $query->limit(100)->get()]);
    }

    public function createOtpChallenge(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'worker_task_id' => ['required', 'integer', 'exists:worker_tasks,id'],
            'provider' => ['required', 'string', 'in:seek,linkedin,indeed,glassdoor'],
            'challenge_ref' => ['nullable', 'string', 'max:190'],
            'expires_in_seconds' => ['nullable', 'integer', 'min:30', 'max:1800'],
            'max_attempts' => ['nullable', 'integer', 'min:1', 'max:10'],
            'metadata_json' => ['nullable', 'array'],
        ]);

        $task = $this->ownedTaskOrFail((int) $validated['worker_task_id']);
        $expiresAt = now()->addSeconds((int) ($validated['expires_in_seconds'] ?? 300));

        $challenge = OtpChallenge::create([
            'tenant_id' => $this->currentTenantId(),
            'user_id' => $this->resolveApiUserId(),
            'worker_task_id' => $task->id,
            'provider' => $validated['provider'],
            'challenge_ref' => $validated['challenge_ref'] ?? null,
            'status' => 'waiting_for_code',
            'code_expires_at' => $expiresAt,
            'max_attempts' => (int) ($validated['max_attempts'] ?? 3),
            'metadata_json' => $validated['metadata_json'] ?? null,
        ]);

        $task->status = 'waiting_for_code';
        $task->checkpoint_code = 'otp_challenge';
        $task->state_reason = 'otp_required';
        $task->save();

        AutomationCheckpoint::create([
            'tenant_id' => $this->currentTenantId(),
            'user_id' => $this->resolveApiUserId(),
            'worker_task_id' => $task->id,
            'checkpoint_code' => 'otp_challenge',
            'status' => 'needs_review',
            'details_json' => [
                'otp_challenge_id' => $challenge->id,
                'provider' => $challenge->provider,
                'expires_at' => $expiresAt?->toIso8601String(),
            ],
            'checkpoint_at' => now(),
        ]);

        $this->audit('automation.otp.challenge.created', 'otp_challenge', $challenge->id, [
            'worker_task_id' => $task->id,
            'provider' => $challenge->provider,
        ]);

        return response()->json(['data' => $challenge], 201);
    }

    public function submitOtpCode(Request $request, OtpChallenge $challenge): JsonResponse
    {
        $this->assertOwnedChallenge($challenge);

        $validated = $request->validate([
            'code' => ['required', 'string', 'min:3', 'max:12'],
        ]);

        if ($challenge->status !== 'waiting_for_code') {
            return response()->json(['error' => 'Challenge is not waiting for code'], 409);
        }

        if ($challenge->code_expires_at && $challenge->code_expires_at->isPast()) {
            $challenge->status = 'expired';
            $challenge->save();

            return response()->json(['error' => 'OTP challenge has expired'], 422);
        }

        $challenge->encrypted_code = $this->encryption->encrypt($validated['code']);
        $challenge->attempt_count = (int) $challenge->attempt_count + 1;
        $challenge->submitted_at = now();
        $challenge->status = 'code_submitted';
        $challenge->save();

        if ($challenge->worker_task_id) {
            WorkerTask::where('id', $challenge->worker_task_id)->update([
                'status' => 'running',
                'checkpoint_code' => 'otp_challenge',
                'state_reason' => 'otp_code_submitted',
            ]);
        }

        $this->audit('automation.otp.code.submitted', 'otp_challenge', $challenge->id, [
            'worker_task_id' => $challenge->worker_task_id,
            'attempt_count' => $challenge->attempt_count,
        ]);

        return response()->json([
            'message' => 'OTP code submitted. Resume the task to continue.',
            'data' => [
                'id' => $challenge->id,
                'status' => $challenge->status,
                'worker_task_id' => $challenge->worker_task_id,
            ],
        ]);
    }

    public function resumeTask(Request $request, WorkerTask $task): JsonResponse
    {
        $task = $this->ownedTaskOrFail((int) $task->id);

        $validated = $request->validate([
            'checkpoint_code' => ['required', 'string', 'max:80'],
            'otp_challenge_id' => ['nullable', 'integer', 'exists:otp_challenges,id'],
            'metadata_json' => ['nullable', 'array'],
        ]);

        $extraPayload = [
            'resume_from_checkpoint' => $validated['checkpoint_code'],
            'resume_requested_at' => now()->toIso8601String(),
            'resume_metadata' => $validated['metadata_json'] ?? null,
        ];

        if (! empty($validated['otp_challenge_id'])) {
            $challenge = OtpChallenge::findOrFail((int) $validated['otp_challenge_id']);
            $this->assertOwnedChallenge($challenge);

            if (! $challenge->encrypted_code) {
                return response()->json(['error' => 'OTP code is not submitted yet'], 422);
            }

            $extraPayload['otp_code'] = $this->encryption->decrypt((string) $challenge->encrypted_code);
            $challenge->status = 'resumed';
            $challenge->resolved_at = now();
            $challenge->save();
        }

        $resumed = $this->workerClient->resume($task, $extraPayload);

        AutomationCheckpoint::create([
            'tenant_id' => $this->currentTenantId(),
            'user_id' => $this->resolveApiUserId(),
            'worker_task_id' => $resumed->id,
            'checkpoint_code' => $validated['checkpoint_code'],
            'status' => 'passed',
            'details_json' => ['resume' => true],
            'checkpoint_at' => now(),
        ]);

        $this->audit('automation.task.resumed', 'worker_task', $resumed->id, [
            'checkpoint_code' => $validated['checkpoint_code'],
        ]);

        return response()->json([
            'message' => 'Worker task resumed from checkpoint.',
            'data' => $resumed,
        ]);
    }

    public function listSessionVault(): JsonResponse
    {
        $rows = BrowserSessionVault::query()
            ->where('tenant_id', $this->currentTenantId())
            ->where('user_id', $this->resolveApiUserId())
            ->orderByDesc('id')
            ->limit(100)
            ->get(['id', 'provider', 'label', 'status', 'expires_at', 'revoked_at', 'last_used_at', 'created_at']);

        return response()->json(['data' => $rows]);
    }

    public function createSessionVault(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'provider' => ['required', 'string', 'in:seek,linkedin,indeed,glassdoor'],
            'session_ref' => ['required', 'string', 'min:20'],
            'label' => ['nullable', 'string', 'max:120'],
            'expires_at' => ['nullable', 'date'],
            'metadata_json' => ['nullable', 'array'],
        ]);

        $vault = BrowserSessionVault::create([
            'tenant_id' => $this->currentTenantId(),
            'user_id' => $this->resolveApiUserId(),
            'provider' => $validated['provider'],
            'label' => $validated['label'] ?? null,
            'encrypted_session_ref' => $this->encryption->encrypt($validated['session_ref']),
            'session_checksum' => hash('sha256', $validated['session_ref']),
            'status' => 'active',
            'expires_at' => $validated['expires_at'] ?? null,
            'metadata_json' => $validated['metadata_json'] ?? null,
        ]);

        $this->audit('automation.session_vault.created', 'browser_session_vault', $vault->id, [
            'provider' => $vault->provider,
            'label' => $vault->label,
        ]);

        return response()->json([
            'data' => [
                'id' => $vault->id,
                'provider' => $vault->provider,
                'label' => $vault->label,
                'status' => $vault->status,
                'expires_at' => $vault->expires_at,
            ],
        ], 201);
    }

    public function revokeSessionVault(BrowserSessionVault $session): JsonResponse
    {
        $this->assertOwnedSession($session);

        $session->status = 'revoked';
        $session->revoked_at = now();
        $session->save();

        $this->audit('automation.session_vault.revoked', 'browser_session_vault', $session->id, [
            'provider' => $session->provider,
        ]);

        return response()->json(['message' => 'Session reference revoked.']);
    }

    private function ownedTaskOrFail(int $taskId): WorkerTask
    {
        $task = WorkerTask::findOrFail($taskId);

        abort_unless(
            (int) $task->tenant_id === $this->currentTenantId() && (int) $task->user_id === $this->resolveApiUserId(),
            403,
            'Forbidden'
        );

        return $task;
    }

    private function assertOwnedChallenge(OtpChallenge $challenge): void
    {
        abort_unless(
            (int) $challenge->tenant_id === $this->currentTenantId() && (int) $challenge->user_id === $this->resolveApiUserId(),
            403,
            'Forbidden'
        );
    }

    private function assertOwnedSession(BrowserSessionVault $session): void
    {
        abort_unless(
            (int) $session->tenant_id === $this->currentTenantId() && (int) $session->user_id === $this->resolveApiUserId(),
            403,
            'Forbidden'
        );
    }

    private function audit(string $action, string $entityType, int $entityId, array $metadata = []): void
    {
        DB::table('audit_events')->insert([
            'tenant_id' => $this->currentTenantId(),
            'user_id' => $this->resolveApiUserId(),
            'actor_type' => 'user',
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'metadata_json' => json_encode($metadata),
            'created_at' => now(),
        ]);
    }
}
