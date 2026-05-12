<?php

namespace App\Services\Sms;

use App\Models\SmsMessage;

class SmsManager
{
    public function send(int $tenantId, int $userId, string $toNumber, string $body, ?string $provider = null): SmsMessage
    {
        $chosen = $provider ?: (string) config('services.sms.default_provider', 'twilio');
        $driver = $this->provider($chosen);
        $result = $driver->send($toNumber, $body);

        return SmsMessage::create([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'provider' => $chosen,
            'to_number' => $toNumber,
            'status' => $result['status'] ?? 'unknown',
            'external_id' => $result['external_id'] ?? null,
            'body' => $body,
            'metadata_json' => ['response' => $result['raw'] ?? null],
        ]);
    }

    private function provider(string $name): SmsProviderInterface
    {
        return match ($name) {
            'sinch', 'sinchmedia' => new SinchSmsProvider(),
            default => new TwilioSmsProvider(),
        };
    }
}
