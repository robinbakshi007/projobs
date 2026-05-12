import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";

interface Tenant {
  id: number;
  name: string;
  slug: string;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("auth_token") ?? "";
  const tenantId = localStorage.getItem("tenant_id") ?? "";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
  };
}

export default function TenantSwitcher() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenantId, setCurrentTenantId] = useState(
    localStorage.getItem("tenant_id") ?? ""
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API}/super-admin/tenants`, {
          headers: authHeaders(),
        });
        if (response.ok) {
          const body = await response.json();
          setTenants(body.data ?? []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const switchTenant = (tenantId: string) => {
    localStorage.setItem("tenant_id", tenantId);
    const tenant = tenants.find((t) => String(t.id) === tenantId);
    if (tenant) {
      localStorage.setItem("tenant_slug", tenant.slug);
    }
    setCurrentTenantId(tenantId);
    window.location.reload();
  };

  if (tenants.length === 0) {
    return null;
  }

  return (
    <div className="tenant-switcher">
      <label>Tenant</label>
      <select
        value={currentTenantId}
        onChange={(e) => switchTenant(e.target.value)}
        disabled={loading}
      >
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}
