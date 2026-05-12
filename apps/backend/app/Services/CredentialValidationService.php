<?php

namespace App\Services;

class CredentialValidationService
{
    public function validate(string $provider, string $username, string $secret): array
    {
        // Provider-specific lightweight checks (no external login attempt yet).
        $providerRules = [
            'seek' => fn () => str_contains($username, '@') && strlen($secret) >= 8,
            'linkedin' => fn () => str_contains($username, '@') && strlen($secret) >= 8,
            'indeed' => fn () => str_contains($username, '@') && strlen($secret) >= 8,
            'glassdoor' => fn () => str_contains($username, '@') && strlen($secret) >= 8,
        ];

        $isValid = isset($providerRules[$provider]) ? (bool) $providerRules[$provider]() : false;

        return [
            'valid' => $isValid,
            'provider' => $provider,
            'checked_at' => now()->toIso8601String(),
        ];
    }
}
