<?php

namespace App\Services\Sms;

use Illuminate\Support\Facades\Http;

class SinchSmsProvider implements SmsProviderInterface
{
    public function send(string $toNumber, string $body): array
    {
        $servicePlanId = (string) config('services.sinch.service_plan_id');
        $apiToken = (string) config('services.sinch.api_token');
        $from = (string) config('services.sinch.from');

        if ($servicePlanId === '' || $apiToken === '' || $from === '') {
            return ['status' => 'skipped', 'external_id' => null, 'raw' => 'Sinch not configured'];
        }

        $url = "https://us.sms.api.sinch.com/xms/v1/{$servicePlanId}/batches";

        $response = Http::withToken($apiToken)
            ->post($url, [
                'from' => $from,
                'to' => [$toNumber],
                'body' => $body,
            ]);

        $json = $response->json();

        return [
            'status' => $response->successful() ? 'sent' : 'failed',
            'external_id' => $json['id'] ?? null,
            'raw' => $json,
        ];
    }
}
