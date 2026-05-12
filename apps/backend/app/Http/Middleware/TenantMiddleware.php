<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves the current tenant from the X-Tenant-Id header (or slug).
 *
 * Downstream code can access the tenant via:
 *   app('tenant')                 → Tenant model
 *   request()->attributes->get('tenant')
 *
 * All controllers that use ResolvesApiUser will automatically scope to
 * the resolved tenant.
 */
class TenantMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $tenantId   = $request->header('X-Tenant-Id');
        $tenantSlug = $request->header('X-Tenant-Slug');

        if ($tenantId) {
            $tenant = Tenant::find((int) $tenantId);
        } elseif ($tenantSlug) {
            $tenant = Tenant::where('slug', $tenantSlug)->first();
        } else {
            // Fall back to default tenant (dev / single-tenant mode)
            $tenant = Tenant::firstOrCreate(
                ['slug' => 'default'],
                [
                    'name'              => 'Default Tenant',
                    'plan'              => 'starter',
                    'daily_apply_limit' => 10,
                    'active'            => true,
                ]
            );
        }

        if (! $tenant || ! $tenant->active) {
            return response()->json(['error' => 'Invalid or inactive tenant'], 403);
        }

        // Bind to service container so any class can resolve it
        app()->instance('tenant', $tenant);
        $request->attributes->set('tenant', $tenant);

        return $next($request);
    }
}
