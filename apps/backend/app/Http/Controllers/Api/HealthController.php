<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class HealthController extends Controller
{
    public function show(): JsonResponse
    {
        $warnings = [];
        if ((bool) config('services.worker.auto_submit_enabled', false)) {
            $warnings[] = 'Global auto-submit is enabled. Review policy and tenant safeguards before production use.';
        }

        return response()->json([
            'status' => 'ok',
            'service' => 'backend-api',
            'warnings' => $warnings,
        ]);
    }
}
