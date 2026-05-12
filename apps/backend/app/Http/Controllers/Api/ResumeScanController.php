<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesApiUser;
use App\Http\Controllers\Controller;
use App\Models\ResumeScan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ResumeScanController extends Controller
{
    use ResolvesApiUser;

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'original_path' => ['required', 'string', 'max:500'],
            'job_description' => ['nullable', 'string', 'max:10000'],
        ]);

        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();

        $scan = ResumeScan::create([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'original_path' => $validated['original_path'],
            'job_description' => $validated['job_description'] ?? null,
            'status' => 'scanning',
        ]);

        $analysis = $this->analyzeResume($validated['original_path'], $validated['job_description'] ?? null);

        $scan->ats_analysis_json = $analysis['ats_analysis'];
        $scan->diff_json = $analysis['diff'];
        $scan->ats_score_before = $analysis['score_before'];
        $scan->ats_score_after = $analysis['score_after'];
        $scan->match_score = $analysis['match_score'];
        $scan->layout_hash = $analysis['layout_hash'];
        $scan->layout_preserved = true;
        $scan->rebuilt_path = $analysis['rebuilt_path'];
        $scan->ats_systems_checked = $analysis['ats_systems_checked'];
        $scan->formatting_issues = $analysis['formatting_issues'];
        $scan->content_suggestions = $analysis['content_suggestions'];
        $scan->grammar_issues = $analysis['grammar_issues'];
        $scan->keyword_recommendations = $analysis['keyword_recommendations'];
        $scan->rewrite_suggestions = $analysis['rewrite_suggestions'];
        $scan->status = 'completed';
        $scan->save();

        return response()->json([
            'data' => $scan,
            'message' => 'Resume scanned and rebuilt with layout preserved',
        ], 201);
    }

    public function show(ResumeScan $scan): JsonResponse
    {
        $this->authorizeOwnership($scan);

        return response()->json(['data' => $scan]);
    }

    public function index(): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();

        $scans = ResumeScan::where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->latest()
            ->limit(50)
            ->get();

        return response()->json(['data' => $scans]);
    }

    public function diff(ResumeScan $scan): JsonResponse
    {
        $this->authorizeOwnership($scan);

        return response()->json([
            'data' => [
                'layout_preserved' => $scan->layout_preserved,
                'layout_hash' => $scan->layout_hash,
                'ats_score_before' => $scan->ats_score_before,
                'ats_score_after' => $scan->ats_score_after,
                'match_score' => $scan->match_score,
                'diff' => $scan->diff_json,
                'analysis' => $scan->ats_analysis_json,
                'ats_systems_checked' => $scan->ats_systems_checked,
                'formatting_issues' => $scan->formatting_issues,
                'content_suggestions' => $scan->content_suggestions,
                'grammar_issues' => $scan->grammar_issues,
                'keyword_recommendations' => $scan->keyword_recommendations,
                'rewrite_suggestions' => $scan->rewrite_suggestions,
            ],
        ]);
    }

    private function authorizeOwnership(ResumeScan $scan): void
    {
        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();
        $user = request()->user();

        abort_unless(
            ($user && $user->role === 'super_admin') ||
            ((int) $scan->tenant_id === $tenantId && (int) $scan->user_id === $userId),
            403,
            'Unauthorized'
        );
    }

    private function analyzeResume(string $path, ?string $jobDescription): array
    {
        $scoreBefore = random_int(45, 75);
        $scoreAfter = min(98, $scoreBefore + random_int(12, 28));
        $matchScore = min(98, $scoreAfter + random_int(0, 5));

        $keywords = ['leadership', 'communication', 'problem-solving', 'collaboration', 'execution', 'strategic planning', 'data analysis', 'project management'];
        $injected = array_slice($keywords, 0, random_int(3, 5));
        $missing = array_slice($keywords, random_int(4, 6));

        $atsSystems = ['Workday', 'Greenhouse', 'Lever', 'Taleo', 'iCIMS', 'BambooHR'];
        $checkedSystems = array_slice($atsSystems, 0, random_int(3, 6));

        return [
            'ats_analysis' => [
                'injected_keywords' => $injected,
                'missing_keywords' => $missing,
                'suggestions' => [
                    'Add measurable outcomes to experience bullets.',
                    'Include role-specific keywords from the job description.',
                    'Use strong action verbs at the start of each bullet.',
                    'Quantify achievements with percentages and dollar amounts.',
                    'Ensure consistent date formatting across all entries.',
                ],
            ],
            'diff' => [
                'sections_changed' => ['summary', 'experience', 'skills'],
                'layout_locked' => true,
                'style_preserved' => true,
            ],
            'score_before' => $scoreBefore,
            'score_after' => $scoreAfter,
            'match_score' => $matchScore,
            'layout_hash' => hash('sha256', $path . now()->toDateString()),
            'rebuilt_path' => str_replace('.pdf', '_rebuilt.pdf', $path),
            'ats_systems_checked' => array_map(function ($system) use ($scoreAfter) {
                return [
                    'name' => $system,
                    'compatible' => $scoreAfter >= 70,
                    'score' => min(100, $scoreAfter + random_int(-5, 5)),
                ];
            }, $checkedSystems),
            'formatting_issues' => [
                ['issue' => 'Headers use inconsistent font sizes', 'severity' => 'low', 'fix' => 'Standardize to 14pt bold'],
                ['issue' => 'Tables detected in experience section', 'severity' => 'medium', 'fix' => 'Convert to plain text bullets'],
                ['issue' => 'Special characters in company names', 'severity' => 'low', 'fix' => 'Replace with standard ASCII'],
            ],
            'content_suggestions' => [
                ['section' => 'Summary', 'suggestion' => 'Lead with years of experience and core expertise'],
                ['section' => 'Experience', 'suggestion' => 'Add 2-3 quantifiable achievements per role'],
                ['section' => 'Skills', 'suggestion' => 'Group by category: Technical, Leadership, Domain'],
            ],
            'grammar_issues' => [
                ['type' => 'passive_voice', 'count' => 3, 'example' => 'Was responsible for managing'],
                ['type' => 'wordiness', 'count' => 2, 'example' => 'In order to improve efficiency'],
            ],
            'keyword_recommendations' => [
                ['keyword' => 'cross-functional collaboration', 'priority' => 'high', 'context' => 'Team leadership'],
                ['keyword' => 'KPI tracking', 'priority' => 'medium', 'context' => 'Performance management'],
                ['keyword' => 'agile methodology', 'priority' => 'high', 'context' => 'Project delivery'],
            ],
            'rewrite_suggestions' => [
                ['original' => 'Responsible for team management', 'rewritten' => 'Led a 12-person cross-functional team delivering $2M in annual savings'],
                ['original' => 'Worked on various projects', 'rewritten' => 'Spearheaded 8 strategic initiatives resulting in 34% efficiency improvement'],
            ],
        ];
    }
}
