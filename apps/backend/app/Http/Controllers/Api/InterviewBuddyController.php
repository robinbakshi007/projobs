<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesApiUser;
use App\Http\Controllers\Controller;
use App\Models\InterviewQuestion;
use App\Models\InterviewResponse;
use App\Models\InterviewSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InterviewBuddyController extends Controller
{
    use ResolvesApiUser;

    public function startSession(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'role_title' => ['required', 'string', 'max:190'],
            'level' => ['nullable', 'in:entry,mid,senior,lead'],
            'mode' => ['nullable', 'in:mock,buddy'],
            'question_count' => ['nullable', 'integer', 'min:1', 'max:20'],
        ]);

        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();

        $session = InterviewSession::create([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'role_title' => $validated['role_title'],
            'level' => $validated['level'] ?? 'mid',
            'mode' => $validated['mode'] ?? 'mock',
            'status' => 'active',
            'total_questions' => $validated['question_count'] ?? 5,
            'rubric_json' => [
                'clarity' => 25,
                'relevance' => 25,
                'structure' => 25,
                'depth' => 25,
            ],
            'started_at' => now(),
        ]);

        $categories = ['behavioral', 'technical', 'situational', 'culture_fit'];
        $count = $session->total_questions;

        for ($i = 0; $i < $count; $i++) {
            InterviewQuestion::create([
                'tenant_id' => $tenantId,
                'user_id' => $userId,
                'interview_session_id' => $session->id,
                'category' => $categories[$i % count($categories)],
                'question_text' => $this->generateQuestionText($session->role_title, $session->level, $categories[$i % count($categories)]),
                'expected_focus' => 'Demonstrate relevant experience and structured reasoning.',
                'difficulty' => min(5, max(1, 2 + (int) floor($i / 2))),
            ]);
        }

        return response()->json([
            'data' => $session->load('questions'),
            'message' => 'Interview session started',
        ], 201);
    }

    public function showSession(InterviewSession $session): JsonResponse
    {
        $this->authorizeOwnership($session);

        return response()->json([
            'data' => $session->load(['questions.response']),
        ]);
    }

    public function submitResponse(Request $request, InterviewQuestion $question): JsonResponse
    {
        $this->authorizeOwnership($question);

        $validated = $request->validate([
            'transcript_text' => ['required', 'string', 'max:10000'],
        ]);

        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();

        $feedback = $this->generateFeedback($question, $validated['transcript_text']);

        $response = InterviewResponse::create([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'interview_question_id' => $question->id,
            'transcript_text' => $validated['transcript_text'],
            'ai_feedback' => $feedback['text'],
            'scores_json' => $feedback['scores'],
            'overall_score' => $feedback['overall'],
        ]);

        $session = $question->interviewSession;
        $session->answered_count = InterviewResponse::whereIn(
            'interview_question_id',
            $session->questions()->pluck('id')
        )->count();

        $avg = InterviewResponse::whereIn(
            'interview_question_id',
            $session->questions()->pluck('id')
        )->avg('overall_score');

        $session->avg_score = $avg ? round((float) $avg, 2) : null;
        $session->save();

        return response()->json([
            'data' => $response,
            'session_progress' => [
                'answered' => $session->answered_count,
                'total' => $session->total_questions,
                'avg_score' => $session->avg_score,
            ],
        ], 201);
    }

    public function endSession(InterviewSession $session): JsonResponse
    {
        $this->authorizeOwnership($session);

        $session->status = 'completed';
        $session->ended_at = now();
        $session->save();

        return response()->json([
            'data' => $session,
            'message' => 'Session completed',
        ]);
    }

    public function history(): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();

        $sessions = InterviewSession::where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->latest()
            ->limit(50)
            ->get();

        return response()->json(['data' => $sessions]);
    }

    private function authorizeOwnership(InterviewSession|InterviewQuestion $model): void
    {
        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();
        $user = request()->user();

        abort_unless(
            ($user && $user->role === 'super_admin') ||
            ((int) $model->tenant_id === $tenantId && (int) $model->user_id === $userId),
            403,
            'Unauthorized'
        );
    }

    private function generateQuestionText(string $role, string $level, string $category): string
    {
        $templates = [
            'behavioral' => "Tell me about a time you faced a significant challenge in a {$role} role and how you overcame it.",
            'technical' => "Walk me through a complex technical problem you solved as a {$role} at the {$level} level.",
            'situational' => "Imagine you are a {$role} and a critical deadline is at risk. What steps do you take?",
            'culture_fit' => "What kind of team environment helps you do your best work as a {$role}?",
        ];

        return $templates[$category] ?? "Describe your approach to excellence in a {$role} position.";
    }

    private function generateFeedback(InterviewQuestion $question, string $transcript): array
    {
        $length = strlen($transcript);
        $hasStructure = str_contains($transcript, 'first') || str_contains($transcript, 'step') || str_contains($transcript, 'then');
        $hasExample = str_contains($transcript, 'example') || str_contains($transcript, 'instance') || str_contains($transcript, 'time');

        $clarity = min(100, max(40, 50 + (int) ($length / 20)));
        $relevance = min(100, max(40, 60 + ($hasExample ? 20 : 0)));
        $structure = min(100, max(40, 50 + ($hasStructure ? 30 : 0)));
        $depth = min(100, max(40, 45 + (int) ($length / 30)));

        $overall = (int) round(($clarity + $relevance + $structure + $depth) / 4);

        $text = "Clarity: {$clarity}/100. Relevance: {$relevance}/100. Structure: {$structure}/100. Depth: {$depth}/100. ";
        $text .= $overall >= 80
            ? "Strong response with clear reasoning."
            : ($overall >= 60 ? "Good foundation. Add more specific examples and structure." : "Consider using the STAR method and adding concrete examples.");

        return [
            'text' => $text,
            'scores' => [
                'clarity' => $clarity,
                'relevance' => $relevance,
                'structure' => $structure,
                'depth' => $depth,
            ],
            'overall' => $overall,
        ];
    }
}
