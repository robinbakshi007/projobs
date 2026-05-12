<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesApiUser;
use App\Http\Controllers\Controller;
use App\Models\ApplicationQuota;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class QuotaController extends Controller
{
    use ResolvesApiUser;

    public function showToday(): JsonResponse
    {
        $userId = $this->resolveApiUserId();
        $tenantId = $this->currentTenantId();
        $today = Carbon::today()->toDateString();

        $quota = ApplicationQuota::firstOrCreate(
            ['tenant_id' => $tenantId, 'user_id' => $userId, 'date_key' => $today],
            [
                'tenant_id' => $tenantId,
                'max_applications' => 10,
                'applied_count' => 0,
                'reserved_count' => 0,
                'updated_at' => now(),
            ]
        );

        return response()->json($quota);
    }

    public function updateToday(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'max_applications' => ['required', 'integer', 'min:1', 'max:500'],
        ]);

        $userId = $this->resolveApiUserId();
        $tenantId = $this->currentTenantId();
        $today = Carbon::today()->toDateString();

        $quota = ApplicationQuota::firstOrCreate(
            ['tenant_id' => $tenantId, 'user_id' => $userId, 'date_key' => $today],
            [
                'tenant_id' => $tenantId,
                'max_applications' => 10,
                'applied_count' => 0,
                'reserved_count' => 0,
                'updated_at' => now(),
            ]
        );

        $quota->max_applications = $validated['max_applications'];
        $quota->updated_at = now();
        $quota->save();

        return response()->json($quota);
    }
}
