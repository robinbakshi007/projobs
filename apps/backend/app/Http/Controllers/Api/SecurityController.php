<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesApiUser;
use App\Http\Controllers\Controller;
use App\Models\SecurityEvent;
use App\Models\User;
use App\Services\Sms\SmsManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class SecurityController extends Controller
{
    use ResolvesApiUser;

    public function requestMfaCode(Request $request, SmsManager $smsManager): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $tenantId = $this->currentTenantId();

        $validated = $request->validate([
            'phone_number' => ['required', 'string', 'max:30'],
            'provider' => ['nullable', 'in:twilio,sinch,sinchmedia'],
        ]);

        $code = (string) random_int(100000, 999999);
        $user->mfa_code_hash = Hash::make($code);
        $user->mfa_code_expires_at = now()->addMinutes(10);
        $user->save();

        $sms = $smsManager->send(
            $tenantId,
            (int) $user->id,
            $validated['phone_number'],
            "Your verification code is {$code}. It expires in 10 minutes.",
            $validated['provider'] ?? null
        );

        SecurityEvent::create([
            'tenant_id' => $tenantId,
            'user_id' => $user->id,
            'event_type' => 'mfa_code_requested',
            'severity' => 'info',
            'ip_address' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
            'metadata_json' => ['sms_status' => $sms->status, 'provider' => $sms->provider],
        ]);

        return response()->json([
            'message' => 'MFA code generated and delivery attempted.',
            'delivery_status' => $sms->status,
            'provider' => $sms->provider,
        ]);
    }

    public function verifyMfaCode(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $tenantId = $this->currentTenantId();

        $validated = $request->validate([
            'code' => ['required', 'string', 'size:6'],
        ]);

        $isValid = ! empty($user->mfa_code_hash)
            && $user->mfa_code_expires_at !== null
            && now()->lte($user->mfa_code_expires_at)
            && Hash::check($validated['code'], $user->mfa_code_hash);

        if (! $isValid) {
            SecurityEvent::create([
                'tenant_id' => $tenantId,
                'user_id' => $user->id,
                'event_type' => 'mfa_code_failed',
                'severity' => 'warning',
                'ip_address' => $request->ip(),
                'user_agent' => (string) $request->userAgent(),
            ]);

            return response()->json(['error' => 'Invalid or expired MFA code'], 422);
        }

        $user->mfa_enabled = true;
        $user->mfa_last_verified_at = now();
        $user->mfa_code_hash = null;
        $user->mfa_code_expires_at = null;
        $user->save();

        SecurityEvent::create([
            'tenant_id' => $tenantId,
            'user_id' => $user->id,
            'event_type' => 'mfa_verified',
            'severity' => 'info',
            'ip_address' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
        ]);

        return response()->json(['message' => 'MFA verified successfully']);
    }

    public function events(): JsonResponse
    {
        $tenantId = $this->currentTenantId();

        $rows = SecurityEvent::where('tenant_id', $tenantId)
            ->latest('created_at')
            ->limit(100)
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function anomalyAlert(Request $request, SmsManager $smsManager): JsonResponse
    {
        $validated = $request->validate([
            'phone_number' => ['required', 'string', 'max:30'],
            'message' => ['required', 'string', 'max:500'],
            'provider' => ['nullable', 'in:twilio,sinch,sinchmedia'],
        ]);

        $tenantId = $this->currentTenantId();
        $userId = $this->resolveApiUserId();

        $sms = $smsManager->send(
            $tenantId,
            $userId,
            $validated['phone_number'],
            $validated['message'],
            $validated['provider'] ?? null
        );

        SecurityEvent::create([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'event_type' => 'anomaly_alert_sent',
            'severity' => $sms->status === 'sent' ? 'warning' : 'critical',
            'ip_address' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
            'metadata_json' => [
                'delivery_status' => $sms->status,
                'provider' => $sms->provider,
            ],
        ]);

        return response()->json([
            'data' => $sms,
            'message' => 'Alert processed',
        ]);
    }
}
