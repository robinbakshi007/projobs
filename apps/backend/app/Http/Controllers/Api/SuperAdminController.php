<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class SuperAdminController extends Controller
{
    public function tenants(): JsonResponse
    {
        $tenants = Tenant::query()->orderBy('name')->get();

        return response()->json([
            'data' => $tenants,
            'count' => $tenants->count(),
        ]);
    }

    public function users(): JsonResponse
    {
        $users = User::query()->with('tenant')->orderBy('created_at', 'desc')->limit(200)->get();

        return response()->json([
            'data' => $users,
            'count' => $users->count(),
        ]);
    }
}
