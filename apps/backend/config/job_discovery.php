<?php

return [
    'scoring' => [
        // Weights should sum to 1.0 for a normalized 0-10 score.
        'weights' => [
            'ai_match' => (float) env('JOB_DISCOVERY_WEIGHT_AI_MATCH', 0.50),
            'role_title' => (float) env('JOB_DISCOVERY_WEIGHT_ROLE_TITLE', 0.18),
            'location' => (float) env('JOB_DISCOVERY_WEIGHT_LOCATION', 0.10),
            'skills_overlap' => (float) env('JOB_DISCOVERY_WEIGHT_SKILLS_OVERLAP', 0.10),
            'salary_range' => (float) env('JOB_DISCOVERY_WEIGHT_SALARY_RANGE', 0.05),
            'work_type' => (float) env('JOB_DISCOVERY_WEIGHT_WORK_TYPE', 0.04),
            'role_type' => (float) env('JOB_DISCOVERY_WEIGHT_ROLE_TYPE', 0.03),
        ],
    ],
];
