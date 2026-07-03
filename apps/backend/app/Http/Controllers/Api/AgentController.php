<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesApiUser;
use App\Http\Controllers\Controller;
use App\Models\AgentTask;
use App\Services\WorkerClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AgentController extends Controller
{
    use ResolvesApiUser;

    public function __construct(private readonly WorkerClient $workerClient) {}

    public function dispatchTask(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'agent_id' => ['required', 'string', 'max:128'],
            'task_type' => ['required', 'string', 'max:64'],
            'payload_json' => ['nullable', 'array'],
            'extension_ref' => ['nullable', 'string', 'max:190'],
        ]);

        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();

        $task = AgentTask::create([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'agent_id' => $validated['agent_id'],
            'task_type' => $validated['task_type'],
            'payload_json' => $validated['payload_json'] ?? null,
            'extension_ref' => $validated['extension_ref'] ?? 'RobinBakshi/ollama-direct-custom-agent',
            'status' => 'queued',
        ]);

        $workerTask = $this->enqueueWorkerFromAgentTask($task, $validated['payload_json'] ?? []);

        return response()->json([
            'data' => $task->fresh(),
            'worker_task_id' => $workerTask?->id,
            'message' => 'Agent task dispatched',
        ], 201);
    }

    public function index(): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();

        $tasks = AgentTask::where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->latest()
            ->limit(100)
            ->get();

        return response()->json(['data' => $tasks]);
    }

    public function show(AgentTask $task): JsonResponse
    {
        $this->authorizeOwnership($task);

        return response()->json(['data' => $task]);
    }

    public function updateResult(Request $request, AgentTask $task): JsonResponse
    {
        $this->authorizeOwnership($task);

        $validated = $request->validate([
            'status' => ['required', 'in:queued,running,succeeded,failed'],
            'result_json' => ['nullable', 'array'],
        ]);

        $task->status = $validated['status'];
        $task->result_json = $validated['result_json'] ?? null;

        if ($validated['status'] === 'running' && $task->started_at === null) {
            $task->started_at = now();
        }

        if (in_array($validated['status'], ['succeeded', 'failed'], true)) {
            $task->completed_at = now();
        }

        $task->save();

        return response()->json(['data' => $task]);
    }

    public function orchestrate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'strategy' => ['required', 'in:sequential,parallel,routing'],
            'agents' => ['required', 'array'],
            'agents.*.agent_id' => ['required', 'string', 'max:128'],
            'agents.*.task_type' => ['required', 'string', 'max:64'],
            'agents.*.payload_json' => ['nullable', 'array'],
        ]);

        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();
        $created = [];

        foreach ($validated['agents'] as $agent) {
            $task = AgentTask::create([
                'tenant_id' => $tenantId,
                'user_id' => $userId,
                'agent_id' => $agent['agent_id'],
                'task_type' => $agent['task_type'],
                'payload_json' => $agent['payload_json'] ?? null,
                'extension_ref' => 'RobinBakshi/ollama-direct-custom-agent',
                'status' => 'queued',
            ]);

            $workerTask = $this->enqueueWorkerFromAgentTask($task, $agent['payload_json'] ?? []);
            $task->result_json = array_merge($task->result_json ?? [], [
                'worker_task_id' => $workerTask?->id,
            ]);
            $task->save();

            $created[] = $task->fresh();
        }

        return response()->json([
            'data' => [
                'strategy' => $validated['strategy'],
                'tasks' => $created,
            ],
            'message' => 'Multi-agent orchestration dispatched',
        ], 201);
    }

    private function authorizeOwnership(AgentTask $task): void
    {
        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();
        $user = request()->user();

        abort_unless(
            ($user && $user->role === 'super_admin') ||
            ((int) $task->tenant_id === $tenantId && (int) $task->user_id === $userId),
            403,
            'Unauthorized'
        );
    }

    private function enqueueWorkerFromAgentTask(AgentTask $task, array $payload): ?\App\Models\WorkerTask
    {
        $mappedTaskType = $this->mapAgentTaskTypeToWorkerType($task->task_type);
        if ($mappedTaskType === null) {
            $task->result_json = array_merge($task->result_json ?? [], [
                'dispatch_notice' => 'No worker mapping for task_type',
                'mapped_worker_task_type' => null,
            ]);
            $task->save();
            return null;
        }

        $workerPayload = array_merge($payload, [
            'agent_task_id' => $task->id,
            'agent_id' => $task->agent_id,
            'source' => $payload['source'] ?? 'seek',
            'idempotency_key' => (string) $task->id,
        ]);

        $workerTask = $this->workerClient->enqueue(
            taskType: $mappedTaskType,
            payload: $workerPayload,
            userId: (int) $task->user_id,
            tenantId: (int) $task->tenant_id,
            foreignRefId: (int) $task->id,
        );

        $task->result_json = array_merge($task->result_json ?? [], [
            'mapped_worker_task_type' => $mappedTaskType,
            'worker_task_id' => $workerTask->id,
            'worker_task_status' => $workerTask->status,
        ]);
        $task->save();

        return $workerTask;
    }

    private function mapAgentTaskTypeToWorkerType(string $taskType): ?string
    {
        return match ($taskType) {
            'tailor_cv', 'write_cover', 'tailor' => 'tailor',
            'apply_seek', 'apply_linkedin', 'apply' => 'apply',
            'scrape_seek', 'scrape_jobs', 'discover_jobs', 'scrape' => 'scrape',
            default => null,
        };
    }
}
