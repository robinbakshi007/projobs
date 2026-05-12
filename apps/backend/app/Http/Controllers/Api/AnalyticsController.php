<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesApiUser;
use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\ApplicationSession;
use App\Models\WorkerTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    use ResolvesApiUser;

    public function overview(Request $request): JsonResponse
    {
        $userId = $this->resolveApiUserId();
        $tenantId = $this->currentTenantId();

        $sessions = ApplicationSession::where('tenant_id', $tenantId)->where('user_id', $userId)->count();
        $appsByStatus = Application::selectRaw('status, COUNT(*) as count')
            ->where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->groupBy('status')
            ->pluck('count', 'status');

        $tasksByStatus = WorkerTask::selectRaw('status, COUNT(*) as count')
            ->where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->groupBy('status')
            ->pluck('count', 'status');

        $avgAts = DB::table('tailoring_runs')
            ->where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->avg('ats_score_after');

        return response()->json([
            'sessions_started' => $sessions,
            'applications' => [
                'pending' => (int) ($appsByStatus['pending'] ?? 0),
                'approved' => (int) ($appsByStatus['approved'] ?? 0),
                'applied' => (int) ($appsByStatus['applied'] ?? 0),
                'failed' => (int) ($appsByStatus['failed'] ?? 0),
                'skipped' => (int) ($appsByStatus['skipped'] ?? 0),
            ],
            'worker_tasks' => [
                'queued' => (int) ($tasksByStatus['queued'] ?? 0),
                'running' => (int) ($tasksByStatus['running'] ?? 0),
                'succeeded' => (int) ($tasksByStatus['succeeded'] ?? 0),
                'failed' => (int) ($tasksByStatus['failed'] ?? 0),
                'dead_letter' => (int) ($tasksByStatus['dead_letter'] ?? 0),
            ],
            'avg_ats_score' => $avgAts ? round((float) $avgAts, 2) : null,
        ]);
    }

    public function funnel(): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();

        $applications = Application::where('tenant_id', $tenantId)
            ->where('user_id', $userId);

        $total = (clone $applications)->count();
        $approved = (clone $applications)->where('status', 'approved')->count();
        $applied = (clone $applications)->where('status', 'applied')->count();
        $failed = (clone $applications)->where('status', 'failed')->count();

        return response()->json([
            'data' => [
                'discovered' => $total,
                'reviewed' => $approved + $failed + $applied,
                'approved' => $approved,
                'submitted' => $applied,
                'failed' => $failed,
                'conversion_rate' => $total > 0 ? round(($applied / $total) * 100, 2) : 0,
            ],
        ]);
    }

    public function cohorts(): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();

        $rows = Application::query()
            ->selectRaw("DATE(created_at) as cohort_day")
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN status = 'applied' THEN 1 ELSE 0 END) as applied")
            ->where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->groupBy('cohort_day')
            ->orderBy('cohort_day', 'desc')
            ->limit(30)
            ->get()
            ->map(function ($row) {
                $total = (int) $row->total;
                $applied = (int) $row->applied;

                return [
                    'cohort_day' => $row->cohort_day,
                    'total' => $total,
                    'applied' => $applied,
                    'conversion_rate' => $total > 0 ? round(($applied / $total) * 100, 2) : 0,
                ];
            });

        return response()->json(['data' => $rows]);
    }
}
