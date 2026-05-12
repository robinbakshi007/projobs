<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesApiUser;
use App\Http\Controllers\Controller;
use App\Models\OnboardingMilestone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductActivationController extends Controller
{
    use ResolvesApiUser;

    private const DEFAULT_MILESTONES = [
        ['code' => 'connect_credentials', 'label' => 'Connect credentials', 'progress_percent' => 20],
        ['code' => 'upload_resume', 'label' => 'Upload resume and cover baseline', 'progress_percent' => 40],
        ['code' => 'start_first_session', 'label' => 'Start first AI apply session', 'progress_percent' => 60],
        ['code' => 'review_and_approve', 'label' => 'Approve first reviewed application', 'progress_percent' => 80],
        ['code' => 'complete_first_apply', 'label' => 'Complete first automated apply', 'progress_percent' => 100],
    ];

    public function milestones(): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();

        foreach (self::DEFAULT_MILESTONES as $milestone) {
            OnboardingMilestone::firstOrCreate(
                ['tenant_id' => $tenantId, 'user_id' => $userId, 'code' => $milestone['code']],
                [
                    'label' => $milestone['label'],
                    'status' => 'todo',
                    'progress_percent' => $milestone['progress_percent'],
                ]
            );
        }

        $rows = OnboardingMilestone::where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->orderBy('progress_percent')
            ->get();

        return response()->json([
            'data' => $rows,
            'completion_percent' => (int) round($rows->where('status', 'done')->count() / max($rows->count(), 1) * 100),
        ]);
    }

    public function updateMilestone(Request $request, string $code): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'in:todo,in_progress,done'],
            'metadata_json' => ['nullable', 'array'],
        ]);

        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();

        $milestone = OnboardingMilestone::where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->where('code', $code)
            ->firstOrFail();

        $milestone->status = $validated['status'];
        $milestone->metadata_json = $validated['metadata_json'] ?? null;
        $milestone->completed_at = $validated['status'] === 'done' ? now() : null;
        $milestone->save();

        return response()->json(['data' => $milestone]);
    }
}
