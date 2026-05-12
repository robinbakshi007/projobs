<?php

namespace App\Http\Middleware;

use App\Models\TenantSubscription;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Enforces subscription status and quota limits for tenant-scoped routes.
 *
 * Behavior:
 * - Allows requests if tenant subscription status is active, trialing, or pending.
 * - Blocks with 402 Payment Required if subscription is canceled or past due and trial has ended.
 * - Can be applied selectively to routes that consume billable resources.
 */
class EnforceSubscription
{
    public function handle(Request $request, Closure $next): Response
    {
        $tenant = app('tenant');

        if (! $tenant) {
            return response()->json(['error' => 'Tenant context required'], 403);
        }

        $subscription = TenantSubscription::where('tenant_id', $tenant->id)->first();

        // If no subscription record exists, allow (legacy / onboarding grace)
        if (! $subscription) {
            return $next($request);
        }

        $allowedStatuses = ['active', 'trialing', 'pending', 'checkout_created'];
        $blockedStatuses = ['canceled', 'past_due', 'unpaid'];

        if (in_array($subscription->status, $blockedStatuses, true)) {
            // Check if still within trial window
            $inTrial = $subscription->trial_ends_at && now()->lt($subscription->trial_ends_at);
            if (! $inTrial) {
                return response()->json([
                    'error' => 'Subscription required',
                    'subscription_status' => $subscription->status,
                    'trial_ended' => true,
                ], 402);
            }
        }

        if (! in_array($subscription->status, $allowedStatuses, true)) {
            // Unknown status — allow but log
            logger()->warning('Unknown subscription status encountered', [
                'tenant_id' => $tenant->id,
                'status' => $subscription->status,
            ]);
        }

        // Attach subscription to request attributes so controllers can read plan/limits
        $request->attributes->set('tenant_subscription', $subscription);

        return $next($request);
    }
}
