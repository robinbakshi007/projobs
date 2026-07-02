<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlatformSetting;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class BillingController extends Controller
{
    private const STRIPE_SETTING_KEY = 'billing.stripe';

    /**
     * Suggested pricing in USD/month for SaaS plans.
     */
    private const PLANS = [
        ['code' => 'starter', 'name' => 'Starter', 'amount_cents' => 1900, 'features' => ['100 AI applies/mo', 'Resume scanner', 'Basic interview prep']],
        ['code' => 'growth', 'name' => 'Growth', 'amount_cents' => 4900, 'features' => ['500 AI applies/mo', 'Advanced ATS scanner', 'Interview buddy']],
        ['code' => 'pro', 'name' => 'Pro', 'amount_cents' => 9900, 'features' => ['Unlimited applies', 'Multi-agent orchestration', 'Priority support']],
        ['code' => 'enterprise', 'name' => 'Enterprise', 'amount_cents' => 24900, 'features' => ['Custom limits', 'SLA + SSO', 'Dedicated onboarding']],
    ];

    public function stripeSettings(): JsonResponse
    {
        $setting = PlatformSetting::where('key', self::STRIPE_SETTING_KEY)->first();
        $value = $setting?->value_json ?? [];

        return response()->json([
            'data' => [
                'mode' => $value['mode'] ?? 'test',
                'publishable_key' => $value['publishable_key'] ?? '',
                'secret_key_configured' => ! empty($value['secret_key_encrypted']),
                'webhook_secret_configured' => ! empty($value['webhook_secret_encrypted']),
            ],
        ]);
    }

    public function saveStripeSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'mode' => ['required', 'in:test,live'],
            'publishable_key' => ['required', 'string', 'max:255'],
            'secret_key' => ['nullable', 'string', 'max:255'],
            'webhook_secret' => ['nullable', 'string', 'max:255'],
        ]);

        $existing = PlatformSetting::where('key', self::STRIPE_SETTING_KEY)->first();
        $existingValue = $existing?->value_json ?? [];

        $value = [
            'mode' => $validated['mode'],
            'publishable_key' => $validated['publishable_key'],
            'secret_key_encrypted' => ! empty($validated['secret_key'])
                ? encrypt($validated['secret_key'])
                : ($existingValue['secret_key_encrypted'] ?? null),
            'webhook_secret_encrypted' => ! empty($validated['webhook_secret'])
                ? encrypt($validated['webhook_secret'])
                : ($existingValue['webhook_secret_encrypted'] ?? null),
        ];

        PlatformSetting::updateOrCreate(
            ['key' => self::STRIPE_SETTING_KEY],
            ['value_json' => $value]
        );

        return response()->json([
            'message' => 'Stripe settings synced to backend successfully',
        ]);
    }

    public function plans(): JsonResponse
    {
        return response()->json(['data' => self::PLANS]);
    }

    public function subscribe(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tenant_id' => ['required', 'integer', 'exists:tenants,id'],
            'plan_code' => ['required', 'in:starter,growth,pro,enterprise'],
            'success_url' => ['required', 'url'],
            'cancel_url' => ['required', 'url'],
        ]);

        $tenant = Tenant::findOrFail($validated['tenant_id']);
        $plan = collect(self::PLANS)->firstWhere('code', $validated['plan_code']);

        $setting = PlatformSetting::where('key', self::STRIPE_SETTING_KEY)->first();
        $value = $setting?->value_json ?? [];
        $encryptedSecret = $value['secret_key_encrypted'] ?? null;

        $subscription = TenantSubscription::updateOrCreate(
            ['tenant_id' => $tenant->id],
            [
                'plan_code' => $plan['code'],
                'status' => 'pending',
                'amount_cents' => $plan['amount_cents'],
                'currency' => 'usd',
                'trial_ends_at' => now()->addDays(14),
                'metadata_json' => ['plan_name' => $plan['name']],
            ]
        );

        // If Stripe keys are not configured yet, return a mock checkout URL for local flow.
        if (! $encryptedSecret) {
            return response()->json([
                'data' => [
                    'mode' => 'mock',
                    'checkout_url' => $validated['success_url'].'?mock_subscription=1',
                    'subscription' => $subscription,
                ],
                'message' => 'Stripe not fully configured. Returned mock checkout URL.',
            ]);
        }

        $secretKey = decrypt($encryptedSecret);

        $response = Http::asForm()
            ->withToken($secretKey)
            ->post('https://api.stripe.com/v1/checkout/sessions', [
                'mode' => 'subscription',
                'success_url' => $validated['success_url'],
                'cancel_url' => $validated['cancel_url'],
                'line_items[0][price_data][currency]' => 'usd',
                'line_items[0][price_data][product_data][name]' => "{$plan['name']} Plan ({$tenant->name})",
                'line_items[0][price_data][recurring][interval]' => 'month',
                'line_items[0][price_data][unit_amount]' => $plan['amount_cents'],
                'line_items[0][quantity]' => 1,
                'metadata[tenant_id]' => (string) $tenant->id,
                'metadata[plan_code]' => $plan['code'],
                'metadata[subscription_id]' => (string) $subscription->id,
            ]);

        if (! $response->successful()) {
            return response()->json([
                'error' => 'Stripe checkout session creation failed',
                'details' => $response->json(),
            ], 422);
        }

        $session = $response->json();

        $subscription->stripe_checkout_session_id = $session['id'] ?? null;
        $subscription->status = 'checkout_created';
        $subscription->save();

        return response()->json([
            'data' => [
                'mode' => 'stripe',
                'checkout_url' => $session['url'] ?? null,
                'session_id' => $session['id'] ?? null,
                'subscription' => $subscription,
            ],
            'message' => 'Stripe checkout session created',
        ]);
    }

    /**
     * Get subscription status for a tenant (super admin view).
     */
    public function subscriptionStatus(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tenant_id' => ['required', 'integer', 'exists:tenants,id'],
        ]);

        $subscription = TenantSubscription::where('tenant_id', $validated['tenant_id'])->first();

        if (! $subscription) {
            return response()->json([
                'data' => null,
            ]);
        }

        return response()->json([
            'data' => [
                'plan_code' => $subscription->plan_code,
                'status' => $subscription->status,
                'trial_ends_at' => $subscription->trial_ends_at?->toIso8601String(),
                'current_period_start' => $subscription->current_period_start?->toIso8601String(),
                'current_period_end' => $subscription->current_period_end?->toIso8601String(),
                'stripe_customer_id' => $subscription->stripe_customer_id,
                'stripe_subscription_id' => $subscription->stripe_subscription_id,
            ],
        ]);
    }

    /**
     * Verify Stripe webhook signature using the configured webhook secret.
     * Returns true if valid, false otherwise.
     */
    private function verifyStripeSignature(Request $request): bool
    {
        $setting = PlatformSetting::where('key', self::STRIPE_SETTING_KEY)->first();
        $value = $setting?->value_json ?? [];
        $encryptedWebhookSecret = $value['webhook_secret_encrypted'] ?? null;

        if (! $encryptedWebhookSecret) {
            // Fail closed outside local/testing when webhook secret is missing.
            return app()->environment(['local', 'testing']);
        }

        $webhookSecret = decrypt($encryptedWebhookSecret);
        $payload = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');

        if (! $sigHeader) {
            return false;
        }

        $timestamp = null;
        $signatures = [];
        foreach (explode(',', $sigHeader) as $part) {
            $part = trim($part);
            if (str_starts_with($part, 't=')) {
                $timestamp = substr($part, 2);
            } elseif (str_starts_with($part, 'v1=')) {
                $signatures[] = substr($part, 3);
            }
        }

        if ($timestamp === null || $signatures === []) {
            return false;
        }

        // Reject events older than 5 minutes to prevent replay attacks
        if (abs(time() - (int) $timestamp) > 300) {
            return false;
        }

        $signedPayload = $timestamp.'.'.$payload;
        $expectedSignature = hash_hmac('sha256', $signedPayload, $webhookSecret);

        foreach ($signatures as $signature) {
            if (hash_equals($expectedSignature, $signature)) {
                return true;
            }
        }

        return false;
    }

    public function stripeWebhook(Request $request): JsonResponse
    {
        if (! $this->verifyStripeSignature($request)) {
            return response()->json(['error' => 'Invalid signature'], 401);
        }

        $event = $request->json()->all();
        $eventType = $event['type'] ?? null;
        $object = $event['data']['object'] ?? [];

        if ($eventType === 'checkout.session.completed') {
            $subscriptionId = (int) ($object['metadata']['subscription_id'] ?? 0);
            if ($subscriptionId > 0) {
                $subscription = TenantSubscription::find($subscriptionId);
                if ($subscription) {
                    $subscription->status = 'active';
                    $subscription->stripe_customer_id = $object['customer'] ?? $subscription->stripe_customer_id;
                    $subscription->stripe_subscription_id = $object['subscription'] ?? $subscription->stripe_subscription_id;
                    $subscription->current_period_start = now();
                    $subscription->current_period_end = now()->addMonth();
                    $subscription->save();
                }
            }
        }

        if ($eventType === 'customer.subscription.updated' || $eventType === 'customer.subscription.created') {
            $stripeSubscriptionId = $object['id'] ?? null;
            if ($stripeSubscriptionId) {
                $subscription = TenantSubscription::where('stripe_subscription_id', $stripeSubscriptionId)->first();
                if ($subscription) {
                    $subscription->status = (string) ($object['status'] ?? $subscription->status);
                    $subscription->current_period_start = isset($object['current_period_start'])
                        ? Carbon::createFromTimestamp((int) $object['current_period_start'])
                        : $subscription->current_period_start;
                    $subscription->current_period_end = isset($object['current_period_end'])
                        ? Carbon::createFromTimestamp((int) $object['current_period_end'])
                        : $subscription->current_period_end;
                    $subscription->save();
                }
            }
        }

        if ($eventType === 'customer.subscription.deleted') {
            $stripeSubscriptionId = $object['id'] ?? null;
            if ($stripeSubscriptionId) {
                TenantSubscription::where('stripe_subscription_id', $stripeSubscriptionId)
                    ->update(['status' => 'canceled']);
            }
        }

        return response()->json(['received' => true]);
    }

    /**
     * Create a Stripe billing portal session for self-serve plan changes/cancellations.
     */
    public function portal(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tenant_id' => ['required', 'integer', 'exists:tenants,id'],
            'return_url' => ['required', 'url'],
        ]);

        $tenant = Tenant::findOrFail($validated['tenant_id']);
        $subscription = TenantSubscription::where('tenant_id', $tenant->id)->first();

        if (! $subscription || ! $subscription->stripe_customer_id) {
            return response()->json([
                'error' => 'No active Stripe subscription found for this tenant.',
            ], 422);
        }

        $setting = PlatformSetting::where('key', self::STRIPE_SETTING_KEY)->first();
        $value = $setting?->value_json ?? [];
        $encryptedSecret = $value['secret_key_encrypted'] ?? null;

        if (! $encryptedSecret) {
            return response()->json([
                'error' => 'Stripe secret key not configured.',
            ], 422);
        }

        $secretKey = decrypt($encryptedSecret);

        $response = Http::asForm()
            ->withToken($secretKey)
            ->post('https://api.stripe.com/v1/billing_portal/sessions', [
                'customer' => $subscription->stripe_customer_id,
                'return_url' => $validated['return_url'],
            ]);

        if (! $response->successful()) {
            return response()->json([
                'error' => 'Stripe billing portal session creation failed',
                'details' => $response->json(),
            ], 422);
        }

        $session = $response->json();

        return response()->json([
            'data' => [
                'url' => $session['url'] ?? null,
            ],
            'message' => 'Billing portal session created',
        ]);
    }
}
