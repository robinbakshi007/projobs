<?php

namespace App\Services;

use App\Models\Tenant;

class AutoSubmitPolicyService
{
    public function isGloballyEnabled(): bool
    {
        return (bool) config('services.worker.auto_submit_enabled', false);
    }

    public function isTenantEnabled(Tenant $tenant): bool
    {
        return (bool) ($tenant->feature_flags['auto_submit_enabled'] ?? false);
    }

    public function isEnabledForTenant(Tenant $tenant): bool
    {
        return $this->isGloballyEnabled() && $this->isTenantEnabled($tenant);
    }

    public function setTenantEnabled(Tenant $tenant, bool $enabled): Tenant
    {
        $flags = $tenant->feature_flags ?? [];
        $flags['auto_submit_enabled'] = $enabled;
        $tenant->feature_flags = $flags;
        $tenant->save();

        return $tenant->refresh();
    }

    public function statusForTenant(Tenant $tenant): array
    {
        return [
            'global_enabled' => $this->isGloballyEnabled(),
            'tenant_enabled' => $this->isTenantEnabled($tenant),
            'effective_enabled' => $this->isEnabledForTenant($tenant),
        ];
    }
}
