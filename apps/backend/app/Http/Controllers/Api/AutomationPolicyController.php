<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesApiUser;
use App\Http\Controllers\Controller;
use App\Services\AutoSubmitPolicyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AutomationPolicyController extends Controller
{
    use ResolvesApiUser;

    public function __construct(private readonly AutoSubmitPolicyService $policy) {}

    public function show(): JsonResponse
    {
        $tenant = $this->currentTenant();

        return response()->json([
            'tenant_id' => $tenant->id,
            ...$this->policy->statusForTenant($tenant),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
        ]);

        $tenant = $this->policy->setTenantEnabled($this->currentTenant(), (bool) $validated['enabled']);

        DB::table('audit_events')->insert([
            'tenant_id' => $tenant->id,
            'user_id' => $this->resolveApiUserId(),
            'actor_type' => 'user',
            'action' => 'automation.auto_submit.policy.updated',
            'entity_type' => 'tenant',
            'entity_id' => $tenant->id,
            'metadata_json' => json_encode([
                'enabled' => (bool) $validated['enabled'],
                ...$this->policy->statusForTenant($tenant),
            ]),
            'created_at' => now(),
        ]);

        return response()->json([
            'message' => 'Auto-submit policy updated for tenant.',
            'tenant_id' => $tenant->id,
            ...$this->policy->statusForTenant($tenant),
        ]);
    }
}
