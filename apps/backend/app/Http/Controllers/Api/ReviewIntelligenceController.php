<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesApiUser;
use App\Http\Controllers\Controller;
use App\Models\ReviewIntelligenceNote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReviewIntelligenceController extends Controller
{
    use ResolvesApiUser;

    public function index(): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();

        $rows = ReviewIntelligenceNote::where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->latest()
            ->limit(100)
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'application_id' => ['nullable', 'integer', 'exists:applications,id'],
            'confidence_score' => ['nullable', 'integer', 'min:0', 'max:100'],
            'ai_explanation' => ['nullable', 'string', 'max:5000'],
            'reviewer_note' => ['nullable', 'string', 'max:5000'],
            'status' => ['nullable', 'in:open,accepted,rejected'],
        ]);

        $note = ReviewIntelligenceNote::create([
            'tenant_id' => $this->currentTenantId(),
            'user_id' => $this->resolveApiUserId(),
            'application_id' => $validated['application_id'] ?? null,
            'confidence_score' => $validated['confidence_score'] ?? null,
            'ai_explanation' => $validated['ai_explanation'] ?? null,
            'reviewer_note' => $validated['reviewer_note'] ?? null,
            'status' => $validated['status'] ?? 'open',
        ]);

        return response()->json(['data' => $note], 201);
    }
}
