<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesApiUser;
use App\Http\Controllers\Controller;
use App\Models\WorkerTask;
use App\Models\WorkerTaskEvent;
use Illuminate\Http\JsonResponse;

class WorkerTaskController extends Controller
{
    use ResolvesApiUser;

    public function index(): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();

        $tasks = WorkerTask::query()
            ->where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->orderByDesc('id')
            ->limit(100)
            ->get();

        return response()->json(['data' => $tasks]);
    }

    public function metrics(): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();

        $counts = WorkerTask::query()
            ->selectRaw('status, COUNT(*) as count')
            ->where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->groupBy('status')
            ->pluck('count', 'status');

        return response()->json([
            'queued' => (int) ($counts['queued'] ?? 0),
            'running' => (int) ($counts['running'] ?? 0),
            'succeeded' => (int) ($counts['succeeded'] ?? 0),
            'failed' => (int) ($counts['failed'] ?? 0),
            'dead_letter' => (int) ($counts['dead_letter'] ?? 0),
        ]);
    }

    public function events(WorkerTask $task): JsonResponse
    {
        abort_unless(
            (int) $task->tenant_id === $this->currentTenantId() && (int) $task->user_id === $this->resolveApiUserId(),
            403,
            'Forbidden'
        );

        $events = WorkerTaskEvent::query()
            ->where('worker_task_id', $task->id)
            ->orderBy('created_at')
            ->get();

        return response()->json(['data' => $events]);
    }
}
