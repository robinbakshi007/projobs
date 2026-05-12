<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireTenantAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['error' => 'Authentication required'], 401);
        }

        if (! in_array($user->role, ['owner', 'admin', 'super_admin'], true)) {
            return response()->json(['error' => 'Tenant admin role required'], 403);
        }

        return $next($request);
    }
}
