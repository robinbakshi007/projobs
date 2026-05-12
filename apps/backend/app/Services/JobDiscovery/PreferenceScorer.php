<?php

namespace App\Services\JobDiscovery;

use App\Models\JobDiscoveryPreference;

class PreferenceScorer
{
    /** @var array<string, float> */
    private array $weights;

    public function __construct()
    {
        /** @var array<string, float> $weights */
        $weights = config('job_discovery.scoring.weights', []);
        $this->weights = $weights;
    }

    /**
     * @param array<string, mixed> $job
     * @return array{score_10: float, breakdown: array<string, mixed>}
     */
    public function score(JobDiscoveryPreference $preference, array $job): array
    {
        $title = strtolower((string) ($job['title'] ?? ''));
        $description = strtolower((string) ($job['description'] ?? ''));
        $location = strtolower((string) ($job['location_text'] ?? ''));
        $salaryText = (string) ($job['salary_text'] ?? '');
        $combined = trim($title . ' ' . $description);

        $signals = [
            'ai_match' => $this->aiMatchSignal($job),
            'role_title' => $this->roleTitleSignal((string) ($preference->role_title ?? ''), $title),
            'location' => $this->locationSignal((string) ($preference->location ?? ''), $location),
            'skills_overlap' => $this->skillsSignal($preference->skills ?? [], $combined),
            'salary_range' => $this->salarySignal($preference, $salaryText),
            'work_type' => $this->workTypeSignal((string) ($preference->work_type ?? ''), $combined),
            'role_type' => $this->roleTypeSignal($preference->industries ?? [], $combined),
        ];

        $weighted = [];
        $rawScore = 0.0;

        foreach ($signals as $key => $signal) {
            $weight = $this->weights[$key] ?? 0.0;
            $weightedScore = $signal * $weight;
            $weighted[$key] = [
                'signal' => round($signal, 4),
                'weight' => round($weight, 4),
                'weighted_score' => round($weightedScore, 4),
            ];
            $rawScore += $weightedScore;
        }

        $score10 = round($this->clamp($rawScore * 10.0, 0.0, 10.0), 2);

        return [
            'score_10' => $score10,
            'breakdown' => [
                'weights' => $this->weights,
                'components' => $weighted,
                'final_score_10' => $score10,
            ],
        ];
    }

    /** @param array<string, mixed> $job */
    private function aiMatchSignal(array $job): float
    {
        $match = (float) ($job['match_score'] ?? 0);
        return $this->clamp($match / 100.0, 0.0, 1.0);
    }

    private function roleTitleSignal(string $roleTitle, string $jobTitle): float
    {
        if ($roleTitle === '') {
            return 0.0;
        }

        return str_contains($jobTitle, strtolower($roleTitle)) ? 1.0 : 0.0;
    }

    private function locationSignal(string $preferredLocation, string $jobLocation): float
    {
        if ($preferredLocation === '') {
            return 0.0;
        }

        return str_contains($jobLocation, strtolower($preferredLocation)) ? 1.0 : 0.0;
    }

    /**
     * @param array<int, string>|null $skills
     */
    private function skillsSignal(?array $skills, string $combinedText): float
    {
        $skills = $skills ?? [];
        $normalized = array_values(array_filter(array_map(static fn ($s) => trim(strtolower((string) $s)), $skills)));

        if (count($normalized) === 0) {
            return 0.0;
        }

        $hits = 0;
        foreach ($normalized as $skill) {
            if ($skill !== '' && str_contains($combinedText, $skill)) {
                $hits++;
            }
        }

        return $this->clamp($hits / max(count($normalized), 1), 0.0, 1.0);
    }

    private function salarySignal(JobDiscoveryPreference $preference, string $salaryText): float
    {
        if ($salaryText === '' || !$preference->min_salary || !$preference->max_salary) {
            return 0.0;
        }

        $parsed = $this->parseSalaryRange($salaryText);
        if (!$parsed || !$parsed['min'] || !$parsed['max']) {
            return 0.0;
        }

        $overlap = $parsed['max'] >= (int) $preference->min_salary && $parsed['min'] <= (int) $preference->max_salary;
        return $overlap ? 1.0 : 0.0;
    }

    private function workTypeSignal(string $workType, string $combinedText): float
    {
        if ($workType === '') {
            return 0.0;
        }

        $tokens = [
            'remote' => ['remote', 'work from home', 'wfh'],
            'onsite' => ['onsite', 'on-site', 'on site'],
            'hybrid' => ['hybrid'],
        ];

        $typeTokens = $tokens[$workType] ?? [];
        if (count($typeTokens) === 0) {
            return 0.0;
        }

        foreach ($typeTokens as $token) {
            if (str_contains($combinedText, $token)) {
                return 1.0;
            }
        }

        return 0.0;
    }

    /** @param array<int, string>|null $industries */
    private function roleTypeSignal(?array $industries, string $combinedText): float
    {
        $industries = $industries ?? [];

        $roleTypes = array_values(array_filter(array_map(static function ($value) {
            $value = (string) $value;
            if (!str_starts_with($value, 'role_type:')) {
                return null;
            }

            return str_replace('role_type:', '', $value);
        }, $industries)));

        if (count($roleTypes) === 0) {
            return 0.0;
        }

        $tokens = [
            'full_time' => ['full time', 'full-time', 'permanent'],
            'part_time' => ['part time', 'part-time'],
            'contract' => ['contract', 'contractor', 'freelance'],
            'casual' => ['casual', 'temp', 'temporary'],
            'internship' => ['internship', 'intern', 'graduate'],
        ];

        foreach ($roleTypes as $roleType) {
            $typeTokens = $tokens[$roleType] ?? [];
            foreach ($typeTokens as $token) {
                if (str_contains($combinedText, $token)) {
                    return 1.0;
                }
            }
        }

        return 0.0;
    }

    /**
     * @return array{min: int|null, max: int|null}|null
     */
    private function parseSalaryRange(string $salaryText): ?array
    {
        preg_match_all('/\$\s*(\d+(?:\.\d+)?)\s*([kKmM]?)/', str_replace(',', '', $salaryText), $matches, PREG_SET_ORDER);

        if (count($matches) === 0) {
            return null;
        }

        $values = [];
        foreach ($matches as $match) {
            $raw = (float) ($match[1] ?? 0);
            $suffix = strtolower((string) ($match[2] ?? ''));
            if ($suffix === 'k') {
                $raw *= 1000;
            } elseif ($suffix === 'm') {
                $raw *= 1000000;
            }
            $values[] = (int) round($raw);
        }

        sort($values);

        return [
            'min' => $values[0] ?? null,
            'max' => $values[count($values) - 1] ?? null,
        ];
    }

    private function clamp(float $value, float $min, float $max): float
    {
        return max($min, min($max, $value));
    }
}
