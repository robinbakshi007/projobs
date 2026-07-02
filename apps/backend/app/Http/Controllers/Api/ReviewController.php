<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesApiUser;
use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\TailoringRun;
use App\Services\AutoSubmitPolicyService;
use App\Services\WorkerClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    use ResolvesApiUser;

    public function __construct(
        private readonly WorkerClient $workerClient,
        private readonly AutoSubmitPolicyService $autoSubmitPolicy,
    ) {}

    public function queue(Request $request): JsonResponse
    {
        $userId = $this->resolveApiUserId();
        $tenantId = $this->currentTenantId();
        $limit = (int) $request->query('limit', 20);

        $apps = Application::query()
            ->with('jobListing')
            ->where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->whereIn('status', ['pending', 'pending_review', 'editing'])
            ->orderBy('id')
            ->limit($limit)
            ->get();

        $data = $apps->map(function (Application $app) use ($userId) {
            $tailor = TailoringRun::query()
                ->where('user_id', $userId)
                ->where('job_listing_id', $app->job_listing_id)
                ->latest('id')
                ->first();

            return [
                'application_id' => $app->id,
                'status' => $app->status,
                'job' => [
                    'id' => $app->jobListing?->id,
                    'title' => $app->jobListing?->title,
                    'company' => $app->jobListing?->company,
                    'location_text' => $app->jobListing?->location_text,
                    'source_url' => $app->jobListing?->source_url,
                    'description_text' => $app->jobListing?->description_text,
                    'posted_at' => $app->jobListing?->posted_at,
                ],
                'tailoring' => [
                    'ats_score_before' => (float) ($tailor?->ats_score_before ?? 0),
                    'ats_score_after' => (float) ($tailor?->ats_score_after ?? 0),
                    'summary_before' => $tailor?->summary_before ?? '',
                    'summary_after' => $tailor?->summary_after ?? '',
                    'injected_keywords' => [],
                    'missing_keywords' => $tailor?->missing_skills_json ?? [],
                    'cv_path' => '',
                    'cl_path' => '',
                ],
            ];
        })->values();

        return response()->json(['data' => $data]);
    }

    public function approve(Application $application): JsonResponse
    {
        $this->assertOwnedApplication($application);

        $application->status = 'approved';
        $application->save();

        if (! $this->autoSubmitPolicy->isEnabledForTenant($this->currentTenant())) {
            return response()->json([
                'message' => 'Application approved. Auto-submit is currently disabled by platform policy.',
                'worker_task_id' => null,
                'auto_submit_enabled' => false,
            ]);
        }

        $task = $this->workerClient->enqueue(
            taskType: 'apply',
            payload: [
                'application_id' => $application->id,
                'job_listing_id' => $application->job_listing_id,
                'review_mode_approved' => true,
                'idempotency_key' => 'review-approve-'.$application->id,
            ],
            userId: $application->user_id,
            tenantId: $application->tenant_id,
            foreignRefId: $application->id,
        );

        return response()->json([
            'message' => 'Application approved and queued for apply',
            'worker_task_id' => $task->id,
        ]);
    }

    public function skip(Application $application): JsonResponse
    {
        $this->assertOwnedApplication($application);

        $application->status = 'skipped';
        $application->save();

        return response()->json(['message' => 'Application skipped']);
    }

    private function assertOwnedApplication(Application $application): void
    {
        $userId = $this->resolveApiUserId();
        $tenantId = $this->currentTenantId();

        abort_unless(
            $application->user_id === $userId && (int) $application->tenant_id === $tenantId,
            403,
            'Forbidden'
        );
    }
}
