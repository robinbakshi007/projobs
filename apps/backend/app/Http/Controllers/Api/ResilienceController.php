<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesApiUser;
use App\Http\Controllers\Controller;
use App\Models\AutomationCheckpoint;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResilienceController extends Controller
{
    use ResolvesApiUser;

    public function index(): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();

        $rows = AutomationCheckpoint::where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->latest('checkpoint_at')
            ->limit(150)
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'worker_task_id' => ['nullable', 'integer', 'exists:worker_tasks,id'],
            'skill_code' => ['nullable', 'string', 'max:80'],
            'selector_version' => ['nullable', 'string', 'max:32'],
            'checkpoint_code' => ['required', 'string', 'max:80'],
            'status' => ['required', 'in:pending,passed,failed,needs_review'],
            'details_json' => ['nullable', 'array'],
        ]);

        $checkpoint = AutomationCheckpoint::create([
            'tenant_id' => $this->currentTenantId(),
            'user_id' => $this->resolveApiUserId(),
            'worker_task_id' => $validated['worker_task_id'] ?? null,
            'skill_code' => $validated['skill_code'] ?? null,
            'selector_version' => $validated['selector_version'] ?? null,
            'checkpoint_code' => $validated['checkpoint_code'],
            'status' => $validated['status'],
            'details_json' => $validated['details_json'] ?? null,
            'checkpoint_at' => now(),
        ]);

        return response()->json(['data' => $checkpoint], 201);
    }

    public function canary(Request $request): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();

        $checkpoint = AutomationCheckpoint::create([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'checkpoint_code' => 'apply_selector_canary',
            'status' => 'needs_review',
            'details_json' => [
                'run_by' => $request->user()?->email,
                'message' => 'Canary run registered. Execute selector validation in worker pipeline.',
            ],
            'checkpoint_at' => now(),
        ]);

        return response()->json([
            'data' => $checkpoint,
            'message' => 'Canary checkpoint created',
        ], 201);
    }
}
