<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\Tenant;
use App\Models\User;

trait ResolvesApiUser
{
    private function resolveApiUserId(): int
    {
        /** @var User|null $user */
        $user = request()->user();

        abort_unless($user, 401, 'Authentication required.');

        if ($user->role !== 'super_admin' && (int) $user->tenant_id !== $this->currentTenantId()) {
            abort(403, 'Authenticated user does not belong to this tenant.');
        }

        return (int) $user->id;
    }

    private function currentTenant(): Tenant
    {
        /** @var Tenant $tenant */
        $tenant = app('tenant');

        return $tenant;
    }

    private function currentTenantId(): int
    {
        return $this->currentTenant()->id;
    }
}
