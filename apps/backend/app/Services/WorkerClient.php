<?php

namespace App\Services;

use App\Models\WorkerTask;
use App\Models\WorkerTaskEvent;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * HTTP client that talks to the Python FastAPI worker.
 *
 * Uses Laravel's Http facade (Guzzle under the hood).
 * On success it also persists the task into the local `worker_tasks` table
 * so the dashboard can track all enqueued work in one place.
 */
class WorkerClient
{
    private string $baseUrl;

    public function __construct()
    {
        $this->baseUrl = rtrim(config('services.worker.url', 'http://localhost:8001'), '/');
    }

    /**
     * Enqueue a task in the Python worker AND create a local worker_tasks row.
     *
     * @param  string  $taskType    scrape|tailor|apply
     * @param  array   $payload     Arbitrary data forwarded to the worker
     * @param  int     $userId      Owner user
     * @param  int     $tenantId    Owner tenant
     * @param  int|null $foreignRefId  Optional FK for tracing (e.g. session_id)
     * @return WorkerTask
     */
    public function enqueue(
        string $taskType,
        array  $payload,
        int    $userId,
        int    $tenantId,
        ?int   $foreignRefId = null,
    ): WorkerTask {
        // 1. Create a local DB record first so we have an ID
        $idempotencyKey = (string) ($payload['idempotency_key'] ?? '');
        if ($idempotencyKey !== '') {
            $existing = WorkerTask::query()
                ->where('tenant_id', $tenantId)
                ->where('user_id', $userId)
                ->where('task_type', $taskType)
                ->where('idempotency_key', $idempotencyKey)
                ->latest('id')
                ->first();

            if ($existing) {
                return $existing;
            }
        }

        $workerTask = WorkerTask::create([
            'tenant_id'      => $tenantId,
            'user_id'        => $userId,
            'task_type'      => $taskType,
            'idempotency_key'=> $idempotencyKey !== '' ? $idempotencyKey : null,
            'foreign_ref_id' => $foreignRefId,
            'payload_json'   => $payload,
            'status'         => 'queued',
            'attempts'       => 0,
        ]);

        $this->event($workerTask, 'task.created', ['task_type' => $taskType]);

        // 2. Call the Python worker asynchronously
        try {
            $response = Http::timeout(5)->post("{$this->baseUrl}/tasks/enqueue", [
                'user_id'    => $userId,
                'task_type'  => $taskType,
                'payload'    => array_merge($payload, ['local_task_id' => $workerTask->id]),
            ]);

            if ($response->successful()) {
                $workerTask->update([
                    'status'      => 'queued',
                    'last_error'  => null,
                    'next_retry_at' => null,
                ]);
                $this->event($workerTask, 'worker.enqueue.success');
            } else {
                Log::warning('Worker enqueue non-2xx', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ]);
                $this->markFailed($workerTask, "HTTP {$response->status()}");
            }
        } catch (\Throwable $e) {
            // Worker is down — record the error but don't fail the API request.
            // A retry job can re-enqueue when the worker comes back.
            Log::error('Worker unreachable: '.$e->getMessage());
            $this->markFailed($workerTask, $e->getMessage());
        }

        return $workerTask;
    }

    private function markFailed(WorkerTask $task, string $error): void
    {
        $attempt = ((int) $task->attempts) + 1;
        $isDeadLetter = $attempt >= 3;

        $task->update([
            'attempts' => $attempt,
            'status' => $isDeadLetter ? 'dead_letter' : 'failed',
            'last_error' => $error,
            'next_retry_at' => $isDeadLetter ? null : now()->addMinutes(2 ** min($attempt, 4)),
        ]);

        $this->event($task, $isDeadLetter ? 'task.dead_letter' : 'task.failed', [
            'attempt' => $attempt,
            'error' => $error,
        ]);
    }

    private function event(WorkerTask $task, string $eventType, array $metadata = []): void
    {
        WorkerTaskEvent::create([
            'tenant_id' => $task->tenant_id,
            'user_id' => $task->user_id,
            'worker_task_id' => $task->id,
            'event_type' => $eventType,
            'metadata_json' => $metadata,
            'created_at' => now(),
        ]);
    }
}
