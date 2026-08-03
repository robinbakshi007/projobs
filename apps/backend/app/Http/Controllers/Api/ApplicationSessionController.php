<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesApiUser;
use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\ApplicationQuota;
use App\Models\ApplicationSession;
use App\Services\AutoSubmitPolicyService;
use App\Services\WorkerClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Carbon;

class ApplicationSessionController extends Controller
{
    use ResolvesApiUser;

    public function __construct(
        private readonly WorkerClient $workerClient,
        private readonly AutoSubmitPolicyService $autoSubmitPolicy,
    ) {}

    public function start(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_selected_job_ids'   => ['required', 'array', 'min:1'],
            'user_selected_job_ids.*' => ['integer', 'min:1'],
            'max_jobs'                => ['required', 'integer', 'min:1', 'max:500'],
            'mode'                    => ['required', 'string', 'in:aggressive,balanced,conservative'],
            'dry_run'                 => ['nullable', 'boolean'],
        ]);

        $userId   = $this->resolveApiUserId();
        $tenantId = $this->currentTenantId();
        $today    = Carbon::today()->toDateString();

        // Plan-level guard: aggressive mode requires at least pro plan.
        if ($validated['mode'] === 'aggressive' && ! in_array($this->currentTenant()->plan, ['pro', 'enterprise'], true)) {
            return response()->json([
                'error' => 'Aggressive mode requires pro or enterprise plan.',
            ], 403);
        }

        $idempotencyKey = (string) $request->header('Idempotency-Key', '');
        if ($idempotencyKey !== '') {
            $cacheKey = "session_start:tenant:{$tenantId}:user:{$userId}:{$idempotencyKey}";
            $cached = Cache::get($cacheKey);
            if (is_array($cached)) {
                return response()->json($cached, 201);
            }
        }

        $quota = ApplicationQuota::firstOrCreate(
            ['tenant_id' => $tenantId, 'user_id' => $userId, 'date_key' => $today],
            [
                'tenant_id'        => $tenantId,
                'max_applications' => $this->currentTenant()->daily_apply_limit ?? 10,
                'applied_count'    => 0,
                'reserved_count'   => 0,
                'updated_at'       => now(),
            ]
        );

        $remaining    = max($quota->max_applications - $quota->applied_count - $quota->reserved_count, 0);
        $requested    = min($validated['max_jobs'], count($validated['user_selected_job_ids']));
        $acceptedCount = min($requested, $remaining);

        $session = ApplicationSession::create([
            'tenant_id'     => $tenantId,
            'user_id'       => $userId,
            'requested_max' => $validated['max_jobs'],
            'mode'          => $validated['mode'],
            'status'        => 'queued',
            'started_at'    => now(),
        ]);

        $jobIds = array_slice($validated['user_selected_job_ids'], 0, $acceptedCount);
        $applicationIds = [];
        foreach ($jobIds as $jobId) {
            $application = Application::create([
                'tenant_id'      => $tenantId,
                'user_id'        => $userId,
                'job_listing_id' => $jobId,
                'session_id'     => $session->id,
                'status'         => 'pending',
            ]);
            $applicationIds[] = $application->id;
        }

        $quota->reserved_count += $acceptedCount;
        $quota->updated_at = now();
        $quota->save();

        // ------------------------------------------------------------------ //
        //  Enqueue the apply task in the Python worker                       //
        // ------------------------------------------------------------------ //
        $workerTask = null;
        $autoSubmitEnabled = $this->autoSubmitPolicy->isEnabledForTenant($this->currentTenant());

        if (! ($validated['dry_run'] ?? false) && $acceptedCount > 0 && $autoSubmitEnabled) {
            $workerTask = $this->workerClient->enqueue(
                taskType:     'apply',
                payload:      [
                    'session_id' => $session->id,
                    'job_ids'    => $jobIds,
                    'application_ids' => $applicationIds,
                    'mode'       => $validated['mode'],
                    'idempotency_key' => $idempotencyKey !== '' ? $idempotencyKey : (string) $session->id,
                ],
                userId:       $userId,
                tenantId:     $tenantId,
                foreignRefId: $session->id,
            );
        }

        $payload = [
            'session_id'     => $session->id,
            'accepted_count' => $acceptedCount,
            'rejected_count' => $requested - $acceptedCount,
            'quota_remaining'=> max($remaining - $acceptedCount, 0),
            'worker_task_id' => $workerTask?->id,
            'auto_submit_enabled' => $autoSubmitEnabled,
        ];

        if ($idempotencyKey !== '') {
            $cacheKey = "session_start:tenant:{$tenantId}:user:{$userId}:{$idempotencyKey}";
            Cache::put($cacheKey, $payload, now()->addMinutes(30));
        }

        return response()->json($payload, 201);
    }

    public function show(ApplicationSession $session): JsonResponse
    {
        abort_unless(
            $session->tenant_id === $this->currentTenantId() && $session->user_id === $this->resolveApiUserId(),
            403,
            'Forbidden'
        );

        return response()->json([
            'session'      => $session,
            'applications' => Application::where('session_id', $session->id)->get(),
        ]);
    }

    public function stop(ApplicationSession $session): JsonResponse
    {
        abort_unless(
            $session->tenant_id === $this->currentTenantId() && $session->user_id === $this->resolveApiUserId(),
            403,
            'Forbidden'
        );

        if (in_array($session->status, ['stopped', 'completed', 'failed'], true)) {
            return response()->json(['session' => $session]);
        }

        $session->status     = 'stopped';
        $session->ended_at   = now();
        $session->stop_reason = 'stopped_by_user';
        $session->save();

        return response()->json(['session' => $session]);
    }
}
