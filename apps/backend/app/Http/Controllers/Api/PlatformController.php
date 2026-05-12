<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class PlatformController extends Controller
{
    public function capabilities(): JsonResponse
    {
        return response()->json([
            'core_features' => [
                'ai_cv_cover_letter_builder',
                'ai_job_applier',
                'interview_buddy_mock_interview',
                'resume_scanner_layout_preserve',
            ],
            'agent_runtime' => [
                'strategy' => 'multi-agent',
                'extension' => 'RobinBakshi/ollama-direct-custom-agent',
                'extension_url' => 'https://open-vsx.org/extension/RobinBakshi/ollama-direct-custom-agent',
            ],
            'sms_providers' => ['twilio', 'sinch', 'sinchmedia'],
        ]);
    }
}
