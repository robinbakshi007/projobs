<?php

namespace App\Services\Sms;

use Illuminate\Support\Facades\Http;

class TwilioSmsProvider implements SmsProviderInterface
{
    public function send(string $toNumber, string $body): array
    {
        $sid = (string) config('services.twilio.account_sid');
        $token = (string) config('services.twilio.auth_token');
        $from = (string) config('services.twilio.from');

        if ($sid === '' || $token === '' || $from === '') {
            return ['status' => 'skipped', 'external_id' => null, 'raw' => 'Twilio not configured'];
        }

        $url = "https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json";

        $response = Http::asForm()
            ->withBasicAuth($sid, $token)
            ->post($url, [
                'To' => $toNumber,
                'From' => $from,
                'Body' => $body,
            ]);

        $json = $response->json();

        return [
            'status' => $response->successful() ? 'sent' : 'failed',
            'external_id' => $json['sid'] ?? null,
            'raw' => $json,
        ];
    }
}
