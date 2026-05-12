<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ResolvesApiUser;
use App\Http\Controllers\Controller;
use App\Models\UserCredential;
use App\Services\CredentialValidationService;
use App\Services\EncryptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * CRUD for per-user platform credentials (Seek, LinkedIn, etc.).
 *
 * Secrets are encrypted at rest using Laravel's APP_KEY via EncryptionService.
 * The raw secret is NEVER returned after creation — the API only returns
 * a masked preview (first 2 + last 2 chars of the plaintext).
 *
 * Routes:
 *   GET    /api/v1/credentials            – list providers for this user
 *   POST   /api/v1/credentials            – store / overwrite a provider secret
 *   GET    /api/v1/credentials/{provider} – single provider metadata
 *   DELETE /api/v1/credentials/{provider} – revoke
 */
class CredentialController extends Controller
{
    use ResolvesApiUser;

    public function __construct(
        private readonly EncryptionService $encryption,
        private readonly CredentialValidationService $validator,
    ) {}

    public function index(): JsonResponse
    {
        $userId = $this->resolveApiUserId();

        $credentials = UserCredential::where('user_id', $userId)
            ->where('tenant_id', $this->currentTenantId())
            ->get(['id', 'provider', 'username', 'status', 'last_validated_at', 'created_at', 'updated_at']);

        return response()->json(['data' => $credentials]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'provider' => ['required', 'string', 'in:seek,linkedin,indeed,glassdoor'],
            'username' => ['required', 'email', 'max:190'],
            'secret'   => ['required', 'string', 'min:6'],
        ]);

        $userId   = $this->resolveApiUserId();
        $tenantId = $this->currentTenantId();

        $encrypted = $this->encryption->encrypt($validated['secret']);

        $credential = UserCredential::updateOrCreate(
            [
                'user_id'   => $userId,
                'tenant_id' => $tenantId,
                'provider'  => $validated['provider'],
            ],
            [
                'username'         => $validated['username'],
                'encrypted_secret' => $encrypted,
                'secret_checksum'  => hash('sha256', $validated['secret']),
                'secret_metadata'  => [
                    'algorithm' => 'AES-256-CBC',
                    'driver'    => 'laravel-crypt',
                ],
                'key_version' => 1,
                'status' => 'active',
            ]
        );

        $this->audit('credential.created', 'user_credential', $credential->id, [
            'provider' => $credential->provider,
        ]);

        return response()->json([
            'id'       => $credential->id,
            'provider' => $credential->provider,
            'username' => $credential->username,
            'secret_preview' => $this->maskSecret($validated['secret']),
            'status'   => $credential->status,
        ], 201);
    }

    public function show(string $provider): JsonResponse
    {
        $userId = $this->resolveApiUserId();

        $credential = UserCredential::where('user_id', $userId)
            ->where('tenant_id', $this->currentTenantId())
            ->where('provider', $provider)
            ->firstOrFail();

        return response()->json([
            'id'               => $credential->id,
            'provider'         => $credential->provider,
            'username'         => $credential->username,
            'status'           => $credential->status,
            'last_validated_at'=> $credential->last_validated_at,
        ]);
    }

    public function update(Request $request, string $provider): JsonResponse
    {
        $validated = $request->validate([
            'username' => ['required', 'email', 'max:190'],
            'secret' => ['nullable', 'string', 'min:6'],
        ]);

        $credential = $this->findCredential($provider);

        $updates = ['username' => $validated['username']];
        if (! empty($validated['secret'])) {
            $updates['encrypted_secret'] = $this->encryption->encrypt($validated['secret']);
            $updates['secret_checksum'] = hash('sha256', $validated['secret']);
        }

        $credential->update($updates);

        $this->audit('credential.updated', 'user_credential', $credential->id, ['provider' => $provider]);

        return response()->json(['message' => 'Credential updated']);
    }

    public function validateCredential(string $provider): JsonResponse
    {
        $credential = $this->findCredential($provider);
        $plain = $this->encryption->decrypt($credential->encrypted_secret);
        $result = $this->validator->validate($provider, (string) $credential->username, $plain);

        if ($result['valid']) {
            $credential->last_validated_at = now();
            $credential->status = 'active';
        } else {
            $credential->status = 'invalid';
        }
        $credential->save();

        $this->audit('credential.validated', 'user_credential', $credential->id, $result);

        return response()->json($result);
    }

    public function rotateKey(string $provider): JsonResponse
    {
        $credential = $this->findCredential($provider);
        $plain = $this->encryption->decrypt($credential->encrypted_secret);
        $credential->encrypted_secret = $this->encryption->encrypt($plain);
        $credential->key_version = ((int) $credential->key_version) + 1;
        $credential->save();

        $this->audit('credential.rotated', 'user_credential', $credential->id, [
            'provider' => $provider,
            'key_version' => $credential->key_version,
        ]);

        return response()->json(['message' => 'Credential key rotated', 'key_version' => $credential->key_version]);
    }

    public function destroy(string $provider): JsonResponse
    {
        $credential = $this->findCredential($provider);
        $credentialId = $credential->id;
        $credential->delete();

        $this->audit('credential.deleted', 'user_credential', $credentialId, ['provider' => $provider]);

        return response()->json(['message' => "Credential for {$provider} revoked."]);
    }

    // ------------------------------------------------------------------ //

    private function maskSecret(string $secret): string
    {
        $len = strlen($secret);
        if ($len <= 4) {
            return str_repeat('*', $len);
        }

        return substr($secret, 0, 2).str_repeat('*', $len - 4).substr($secret, -2);
    }

    private function findCredential(string $provider): UserCredential
    {
        return UserCredential::where('user_id', $this->resolveApiUserId())
            ->where('tenant_id', $this->currentTenantId())
            ->where('provider', $provider)
            ->firstOrFail();
    }

    private function audit(string $action, string $entityType, int $entityId, array $metadata = []): void
    {
        DB::table('audit_events')->insert([
            'tenant_id' => $this->currentTenantId(),
            'user_id' => $this->resolveApiUserId(),
            'actor_type' => 'user',
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'metadata_json' => json_encode($metadata),
            'created_at' => now(),
        ]);
    }
}
