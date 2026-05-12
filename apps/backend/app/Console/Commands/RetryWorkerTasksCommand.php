<?php

namespace App\Console\Commands;

use App\Models\WorkerTask;
use App\Services\WorkerClient;
use Illuminate\Console\Command;

class RetryWorkerTasksCommand extends Command
{
    protected $signature = 'worker:retry-failed {--max=3 : Max retry attempts before dead-letter} {--limit=100}';

    protected $description = 'Retry failed worker tasks and dead-letter exhausted tasks';

    public function handle(WorkerClient $workerClient): int
    {
        $maxAttempts = (int) $this->option('max');
        $limit = (int) $this->option('limit');

        $tasks = WorkerTask::query()
            ->where('status', 'failed')
            ->where(function ($q): void {
                $q->whereNull('next_retry_at')->orWhere('next_retry_at', '<=', now());
            })
            ->orderBy('id')
            ->limit($limit)
            ->get();

        $retried = 0;
        $dead = 0;

        foreach ($tasks as $task) {
            if ($task->attempts >= $maxAttempts) {
                $task->status = 'dead_letter';
                $task->next_retry_at = null;
                $task->save();
                $dead++;
                continue;
            }

            $workerClient->enqueue(
                taskType: $task->task_type,
                payload: $task->payload_json ?? [],
                userId: (int) $task->user_id,
                tenantId: (int) $task->tenant_id,
                foreignRefId: $task->foreign_ref_id,
            );

            $task->attempts += 1;
            $task->status = 'queued';
            $task->next_retry_at = null;
            $task->save();
            $retried++;
        }

        $this->info("Retried: {$retried}, dead-lettered: {$dead}");

        return self::SUCCESS;
    }
}
