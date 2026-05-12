<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function superAdminLogin(Request $request): JsonResponse
    {
        if (! config('services.super_admin.quick_login_enabled')) {
            return response()->json(['error' => 'Super admin quick login is disabled'], 403);
        }

        $validated = $request->validate([
            'password' => ['nullable', 'string'],
        ]);

        $expectedPassword = (string) config('services.super_admin.password');
        $suppliedPassword = (string) ($validated['password'] ?? '');
        $passwordRequired = ! app()->environment('local');

        if ($passwordRequired && ! hash_equals($expectedPassword, $suppliedPassword)) {
            throw ValidationException::withMessages([
                'password' => ['Invalid super admin password.'],
            ]);
        }

        $tenant = Tenant::firstOrCreate(
            ['slug' => 'platform-admin'],
            [
                'name' => 'Platform Admin',
                'plan' => 'enterprise',
                'daily_apply_limit' => 10000,
                'active' => true,
                'feature_flags' => ['all_features' => true],
            ]
        );

        $email = (string) config('services.super_admin.email');
        $user = User::updateOrCreate(
            ['email' => $email],
            [
                'tenant_id' => $tenant->id,
                'name' => 'Super Admin',
                'password' => Hash::make($expectedPassword),
                'timezone' => 'UTC',
                'role' => 'super_admin',
                'email_verified_at' => now(),
            ]
        );

        $token = $user->createToken('super-admin')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user,
            'tenant' => $tenant,
            'capabilities' => ['super_admin', 'tenant_admin', 'ops', 'analytics'],
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'tenant_name' => ['required', 'string', 'max:190'],
            'tenant_slug' => ['nullable', 'string', 'max:64', 'regex:/^[a-z0-9-]+$/', 'unique:tenants,slug'],
        ]);

        $tenant = Tenant::create([
            'name' => $validated['tenant_name'],
            'slug' => $validated['tenant_slug'] ?? Str::slug($validated['tenant_name'].'-'.Str::random(4)),
            'plan' => 'starter',
            'daily_apply_limit' => 10,
            'active' => true,
            'manifest' => [
                'review_mode_required' => true,
                'seek_submit_enabled' => false,
            ],
        ]);

        $user = User::create([
            'tenant_id' => $tenant->id,
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'timezone' => 'UTC',
            'role' => 'owner',
        ]);

        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user,
            'tenant' => $tenant,
        ], 201);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $user = User::where('email', $validated['email'])->first();
        if (! $user) {
            return response()->json(['message' => 'If the account exists, reset token was generated.']);
        }

        $token = Str::random(64);
        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $validated['email']],
            ['token' => Hash::make($token), 'created_at' => now()]
        );

        return response()->json([
            'message' => 'Password reset token generated',
            'reset_token' => $token,
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $record = DB::table('password_reset_tokens')->where('email', $validated['email'])->first();
        if (! $record || ! Hash::check($validated['token'], $record->token)) {
            throw ValidationException::withMessages(['token' => ['Invalid reset token']]);
        }

        $user = User::where('email', $validated['email'])->firstOrFail();
        $user->password = Hash::make($validated['password']);
        $user->save();

        DB::table('password_reset_tokens')->where('email', $validated['email'])->delete();

        return response()->json(['message' => 'Password reset successful']);
    }

    public function sendVerification(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->email_verified_at) {
            return response()->json(['message' => 'Email already verified']);
        }

        $token = Str::random(64);
        $user->email_verification_token = Hash::make($token);
        $user->save();

        return response()->json([
            'message' => 'Verification token generated',
            'verification_token' => $token,
        ]);
    }

    public function verifyEmail(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string'],
        ]);

        $user = User::where('email', $validated['email'])->firstOrFail();

        if (! $user->email_verification_token || ! Hash::check($validated['token'], $user->email_verification_token)) {
            throw ValidationException::withMessages(['token' => ['Invalid verification token']]);
        }

        $user->email_verified_at = now();
        $user->email_verification_token = null;
        $user->save();

        return response()->json(['message' => 'Email verified']);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'tenant_slug' => ['nullable', 'string', 'max:64'],
        ]);

        $query = User::query()->where('email', $validated['email']);

        if (! empty($validated['tenant_slug'])) {
            $tenant = Tenant::where('slug', $validated['tenant_slug'])->first();
            if (! $tenant) {
                throw ValidationException::withMessages([
                    'tenant_slug' => ['Unknown tenant.'],
                ]);
            }
            $query->where('tenant_id', $tenant->id);
        }

        $user = $query->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ]);
        }

        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user,
            'tenant' => $user->tenant,
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'user' => $user,
            'tenant' => $user->tenant,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out']);
    }
}
