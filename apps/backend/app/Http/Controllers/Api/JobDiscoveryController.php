<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesApiUser;
use App\Http\Controllers\Controller;
use App\Models\JobDiscoveryPreference;
use App\Models\JobDiscoveryResult;
use App\Services\JobDiscovery\PreferenceScorer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class JobDiscoveryController extends Controller
{
    use ResolvesApiUser;

    public function __construct(private readonly PreferenceScorer $preferenceScorer)
    {
    }

    public function storePreference(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'role_title' => ['required', 'string', 'max:190'],
            'location' => ['nullable', 'string', 'max:120'],
            'work_type' => ['nullable', 'in:remote,onsite,hybrid'],
            'skills' => ['nullable', 'array'],
            'industries' => ['nullable', 'array'],
            'min_salary' => ['nullable', 'integer', 'min:0'],
            'max_salary' => ['nullable', 'integer', 'min:0'],
            'currency' => ['nullable', 'string', 'max:8'],
            'experience_level' => ['nullable', 'in:entry,mid,senior,lead'],
        ]);

        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();

        $preference = JobDiscoveryPreference::updateOrCreate(
            ['tenant_id' => $tenantId, 'user_id' => $userId],
            [
                'role_title' => $validated['role_title'],
                'location' => $validated['location'] ?? null,
                'work_type' => $validated['work_type'] ?? null,
                'skills' => $validated['skills'] ?? null,
                'industries' => $validated['industries'] ?? null,
                'min_salary' => $validated['min_salary'] ?? null,
                'max_salary' => $validated['max_salary'] ?? null,
                'currency' => $validated['currency'] ?? 'USD',
                'experience_level' => $validated['experience_level'] ?? null,
            ]
        );

        // Keep historical discovery rows consistent with the latest preference profile.
        $this->rescoreRowsForPreference($preference);

        return response()->json([
            'data' => $preference,
            'message' => 'Preference saved',
        ]);
    }

    public function searchJobs(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'preference_id' => ['required', 'integer', 'exists:job_discovery_preferences,id'],
            'query' => ['required', 'string', 'max:500'],
        ]);

        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();

        $preference = JobDiscoveryPreference::findOrFail($validated['preference_id']);
        $this->authorizePreference($preference);

        // Simulate Google Grounding Search results
        $results = $this->simulateJobSearch($preference, $validated['query']);

        $created = [];
        foreach ($results as $result) {
            $scored = $this->preferenceScorer->score($preference, $result);

            $created[] = JobDiscoveryResult::create([
                'tenant_id' => $tenantId,
                'user_id' => $userId,
                'job_discovery_preference_id' => $preference->id,
                'source' => 'google_grounding',
                'external_id' => $result['external_id'],
                'title' => $result['title'],
                'company' => $result['company'],
                'location_text' => $result['location_text'],
                'description' => $result['description'],
                'apply_url' => $result['apply_url'],
                'salary_text' => $result['salary_text'],
                'posted_at' => $result['posted_at'],
                'match_score' => $result['match_score'],
                'preference_score_10' => $scored['score_10'],
                'metadata_json' => $result['metadata'],
                'score_breakdown_json' => $scored['breakdown'],
            ]);
        }

        return response()->json([
            'data' => [
                'preference' => $preference,
                'results' => $created,
                'total_found' => count($created),
            ],
            'message' => 'Jobs discovered via Google Grounding Search',
        ], 201);
    }

    public function results(): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();

        $results = JobDiscoveryResult::where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->with('preference')
            ->latest()
            ->limit(100)
            ->get();

        foreach ($results as $result) {
            if ($result->preference_score_10 !== null) {
                continue;
            }

            $result->loadMissing('preference');
            if (!$result->preference) {
                continue;
            }

            $scored = $this->preferenceScorer->score($result->preference, [
                'title' => $result->title,
                'description' => $result->description,
                'location_text' => $result->location_text,
                'salary_text' => $result->salary_text,
                'match_score' => $result->match_score,
            ]);

            $result->preference_score_10 = $scored['score_10'];
            $result->score_breakdown_json = $scored['breakdown'];
            $result->save();
        }

        return response()->json(['data' => $results]);
    }

    public function updateResultStatus(Request $request, JobDiscoveryResult $result): JsonResponse
    {
        $this->authorizeResult($result);

        $validated = $request->validate([
            'status' => ['required', 'in:new,viewed,saved,applied'],
        ]);

        $result->status = $validated['status'];
        $result->save();

        return response()->json(['data' => $result]);
    }

    public function preferences(): JsonResponse
    {
        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();

        $preferences = JobDiscoveryPreference::where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->get();

        return response()->json(['data' => $preferences]);
    }

    private function authorizePreference(JobDiscoveryPreference $preference): void
    {
        $user = request()->user();
        abort_unless(
            ($user && $user->role === 'super_admin') ||
            ((int) $preference->tenant_id === $this->currentTenantId() && (int) $preference->user_id === $this->resolveApiUserId()),
            403,
            'Unauthorized'
        );
    }

    private function authorizeResult(JobDiscoveryResult $result): void
    {
        $user = request()->user();
        abort_unless(
            ($user && $user->role === 'super_admin') ||
            ((int) $result->tenant_id === $this->currentTenantId() && (int) $result->user_id === $this->resolveApiUserId()),
            403,
            'Unauthorized'
        );
    }

    private function simulateJobSearch(JobDiscoveryPreference $preference, string $query): array
    {
        $companies = ['Google', 'Microsoft', 'Amazon', 'Meta', 'Apple', 'Netflix', 'Stripe', 'Airbnb'];
        $locations = ['San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Austin, TX', 'Remote'];
        $titles = [
            $preference->role_title,
            'Senior ' . $preference->role_title,
            'Lead ' . $preference->role_title,
            'Principal ' . $preference->role_title,
        ];

        $results = [];
        for ($i = 0; $i < 5; $i++) {
            $matchScore = random_int(65, 98);
            $results[] = [
                'external_id' => 'gg_' . uniqid(),
                'title' => $titles[$i % count($titles)],
                'company' => $companies[$i % count($companies)],
                'location_text' => $locations[$i % count($locations)],
                'description' => "We are looking for a talented {$preference->role_title} to join our team. You will work on cutting-edge projects and collaborate with cross-functional teams.",
                'apply_url' => "https://careers.example.com/apply/{$i}",
                'salary_text' => '$' . random_int(80, 200) . 'K - $' . random_int(120, 300) . 'K',
                'posted_at' => now()->subDays(random_int(1, 14))->toDateTimeString(),
                'match_score' => $matchScore,
                'metadata' => [
                    'source_url' => "https://google.com/search?q={$query}",
                    'search_engine' => 'google_grounding',
                    'keywords_matched' => array_slice($preference->skills ?? ['leadership', 'communication'], 0, 3),
                ],
            ];
        }

        return $results;
    }

    private function rescoreRowsForPreference(JobDiscoveryPreference $preference): void
    {
        $rows = JobDiscoveryResult::where('tenant_id', $preference->tenant_id)
            ->where('user_id', $preference->user_id)
            ->where('job_discovery_preference_id', $preference->id)
            ->get();

        foreach ($rows as $row) {
            $scored = $this->preferenceScorer->score($preference, [
                'title' => $row->title,
                'description' => $row->description,
                'location_text' => $row->location_text,
                'salary_text' => $row->salary_text,
                'match_score' => $row->match_score,
            ]);

            $row->preference_score_10 = $scored['score_10'];
            $row->score_breakdown_json = $scored['breakdown'];
            $row->save();
        }
    }
}
