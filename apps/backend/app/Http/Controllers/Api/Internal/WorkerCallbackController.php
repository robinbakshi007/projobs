<?php

namespace App\Http\Controllers\Api\Internal;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\AutomationCheckpoint;
use App\Models\JobListing;
use App\Models\WorkerTask;
use App\Models\WorkerTaskEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Called by the Python worker to push results back into Laravel / MySQL.
 *
 * These are internal endpoints — in production they should be protected
 * by a shared WORKER_INTERNAL_SECRET header.
 */
class WorkerCallbackController extends Controller
{
    private function audit(string $action, string $entityType, ?int $entityId, array $metadata = []): void
    {
        DB::table('audit_events')->insert([
            'tenant_id' => null,
            'user_id' => null,
            'actor_type' => 'worker',
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'metadata_json' => json_encode($metadata),
            'created_at' => now(),
        ]);
    }

    // ------------------------------------------------------------------ //
    //  POST /api/v1/internal/worker/checkpoint-status                    //
    // ------------------------------------------------------------------ //

    public function checkpointStatus(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'task_id' => ['required', 'integer', 'exists:worker_tasks,id'],
            'status' => ['required', 'string', 'in:running,waiting_for_code,waiting_for_review,blocked,completed,failed'],
            'checkpoint_code' => ['required', 'string', 'max:80'],
            'skill_code' => ['nullable', 'string', 'max:80'],
            'selector_version' => ['nullable', 'string', 'max:32'],
            'state_reason' => ['nullable', 'string', 'max:190'],
            'details' => ['nullable', 'array'],
        ]);

        $task = WorkerTask::findOrFail((int) $validated['task_id']);
        $task->status = $validated['status'];
        $task->checkpoint_code = $validated['checkpoint_code'];
        $task->state_reason = $validated['state_reason'] ?? null;
        $task->save();

        WorkerTaskEvent::create([
            'tenant_id' => $task->tenant_id,
            'user_id' => $task->user_id,
            'worker_task_id' => $task->id,
            'event_type' => 'worker.callback.checkpoint_status',
            'metadata_json' => [
                'status' => $validated['status'],
                'checkpoint_code' => $validated['checkpoint_code'],
                'skill_code' => $validated['skill_code'] ?? null,
                'selector_version' => $validated['selector_version'] ?? null,
                'state_reason' => $validated['state_reason'] ?? null,
                'details' => $validated['details'] ?? null,
            ],
            'created_at' => now(),
        ]);

        AutomationCheckpoint::create([
            'tenant_id' => $task->tenant_id,
            'user_id' => $task->user_id,
            'worker_task_id' => $task->id,
            'skill_code' => $validated['skill_code'] ?? null,
            'selector_version' => $validated['selector_version'] ?? null,
            'checkpoint_code' => $validated['checkpoint_code'],
            'status' => $this->checkpointResultStatus($validated['status']),
            'details_json' => $validated['details'] ?? null,
            'checkpoint_at' => now(),
        ]);

        $this->audit('worker.checkpoint.status', 'worker_task', $task->id, [
            'status' => $validated['status'],
            'checkpoint_code' => $validated['checkpoint_code'],
            'skill_code' => $validated['skill_code'] ?? null,
            'selector_version' => $validated['selector_version'] ?? null,
        ]);

        return response()->json(['ok' => true]);
    }

    // ------------------------------------------------------------------ //
    //  POST /api/v1/internal/worker/scrape-complete                      //
    // ------------------------------------------------------------------ //

    /**
     * Accept a batch of normalised JobPost objects from the scraper worker
     * and upsert them into job_listings.
     *
     * Payload shape:
     * {
     *   "task_id": 42,
     *   "jobs": [
     *     {
     *       "source":          "seek",
     *       "external_job_id": "12345",
     *       "source_url":      "https://...",
     *       "title":           "Backend Engineer",
     *       "company":         "Acme",
     *       "location_text":   "Sydney, NSW",
     *       "remote_flag":     false,
     *       "job_type_text":   "Full-time",
     *       "posted_at":       "2026-05-10T08:00:00Z",
     *       "description_text":"...",
     *       "salary_text":     "$120k–$140k",
     *       "raw_payload_json": {...}
     *     }
     *   ]
     * }
     */
    public function scrapeComplete(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'task_id'          => ['nullable', 'integer'],
            'jobs'             => ['required', 'array', 'min:1'],
            'jobs.*.source'    => ['required', 'string'],
            'jobs.*.schema_version' => ['nullable', 'string'],
            'jobs.*.external_job_id' => ['required', 'string'],
            'jobs.*.title'     => ['required', 'string'],
        ]);

        $saved = 0;
        $now   = now();

        foreach ($validated['jobs'] as $job) {
            JobListing::upsert(
                [
                    'source'           => $job['source'],
                    'schema_version'   => $job['schema_version'] ?? '1.0',
                    'external_job_id'  => $job['external_job_id'],
                    'source_url'       => $job['source_url'] ?? null,
                    'title'            => $job['title'],
                    'company'          => $job['company'] ?? null,
                    'location_text'    => $job['location_text'] ?? null,
                    'remote_flag'      => $job['remote_flag'] ?? false,
                    'job_type_text'    => $job['job_type_text'] ?? null,
                    'posted_at'        => $job['posted_at'] ?? null,
                    'description_text' => $job['description_text'] ?? null,
                    'salary_text'      => $job['salary_text'] ?? null,
                    'raw_payload_json' => isset($job['raw_payload_json'])
                        ? json_encode($job['raw_payload_json'])
                        : null,
                    'first_seen_at'    => $now,
                    'last_seen_at'     => $now,
                    'created_at'       => $now,
                    'updated_at'       => $now,
                ],
                ['source', 'external_job_id'],     // unique key
                ['last_seen_at', 'updated_at', 'title', 'company', 'description_text', 'salary_text'],
            );

            $saved++;
        }

        if ($validated['task_id'] ?? null) {
            WorkerTask::where('id', $validated['task_id'])
                ->update(['status' => 'succeeded', 'updated_at' => now()]);

            $task = WorkerTask::find((int) $validated['task_id']);
            if ($task) {
                WorkerTaskEvent::create([
                    'tenant_id' => $task->tenant_id,
                    'user_id' => $task->user_id,
                    'worker_task_id' => $task->id,
                    'event_type' => 'worker.callback.scrape_complete',
                    'metadata_json' => ['saved' => $saved],
                    'created_at' => now(),
                ]);
            }
        }

        $this->audit('worker.scrape.complete', 'worker_task', $validated['task_id'] ?? null, [
            'saved' => $saved,
        ]);

        return response()->json(['saved' => $saved]);
    }

    // ------------------------------------------------------------------ //
    //  POST /api/v1/internal/worker/apply-progress                       //
    // ------------------------------------------------------------------ //

    /**
     * Incremental status update for a single application step.
     *
     * Payload: { "application_id": 7, "step": "upload_cv", "status": "done", "evidence_path": "/..." }
     */
    public function applyProgress(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'application_id' => ['required', 'integer'],
            'step'           => ['required', 'string'],
            'status'         => ['required', 'string', 'in:running,done,failed'],
            'evidence_path'  => ['nullable', 'string'],
            'metadata'       => ['nullable', 'array'],
        ]);

        DB::table('application_steps')->insert([
            'application_id' => $validated['application_id'],
            'step_name'      => $validated['step'],
            'status'         => $validated['status'],
            'evidence_path'  => $validated['evidence_path'] ?? null,
            'metadata_json'  => isset($validated['metadata']) ? json_encode($validated['metadata']) : null,
            'created_at'     => now(),
        ]);

        $this->audit('worker.apply.progress', 'application', (int) $validated['application_id'], [
            'step' => $validated['step'],
            'status' => $validated['status'],
        ]);

        return response()->json(['ok' => true]);
    }

    // ------------------------------------------------------------------ //
    //  POST /api/v1/internal/worker/apply-complete                       //
    // ------------------------------------------------------------------ //

    /**
     * Final completion signal for an application.
     *
     * Payload: { "application_id": 7, "status": "applied", "failure_code": null }
     */
    public function applyComplete(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'application_id' => ['required', 'integer'],
            'status'         => ['required', 'string', 'in:applied,failed,skipped'],
            'failure_code'   => ['nullable', 'string'],
            'failure_detail' => ['nullable', 'string'],
        ]);

        Application::where('id', $validated['application_id'])
            ->update([
                'status'         => $validated['status'],
                'failure_code'   => $validated['failure_code'] ?? null,
                'failure_detail' => $validated['failure_detail'] ?? null,
                'submitted_at'   => $validated['status'] === 'applied' ? now() : null,
                'updated_at'     => now(),
            ]);

        $this->audit('worker.apply.complete', 'application', (int) $validated['application_id'], [
            'status' => $validated['status'],
            'failure_code' => $validated['failure_code'] ?? null,
        ]);

        return response()->json(['ok' => true]);
    }

    private function checkpointResultStatus(string $taskStatus): string
    {
        return match ($taskStatus) {
            'completed' => 'passed',
            'failed', 'blocked' => 'failed',
            default => 'needs_review',
        };
    }
}
