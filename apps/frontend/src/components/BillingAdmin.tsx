import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";

type StripeSettings = {
  mode: "test" | "live";
  publishable_key: string;
  secret_key_configured: boolean;
  webhook_secret_configured: boolean;
};

type Plan = {
  code: string;
  name: string;
  amount_cents: number;
  features: string[];
};

type Tenant = {
  id: number;
  name: string;
  slug: string;
};

type SubscriptionStatus = {
  plan_code: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
};

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("auth_token") ?? "";
  const tenantId = localStorage.getItem("tenant_id") ?? "";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
  };
}

export default function BillingAdmin() {
  const [settings, setSettings] = useState<StripeSettings>({
    mode: "test",
    publishable_key: "",
    secret_key_configured: false,
    webhook_secret_configured: false,
  });
  const [publishableKey, setPublishableKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [mode, setMode] = useState<"test" | "live">("test");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [checkoutStatus, setCheckoutStatus] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [portalStatus, setPortalStatus] = useState("");

  useEffect(() => {
    loadSettings();
    loadPlans();
    loadTenants();
  }, []);

  useEffect(() => {
    if (selectedTenant) {
      loadSubscriptionStatus(Number(selectedTenant));
    }
  }, [selectedTenant]);

  const loadSettings = async () => {
    const response = await fetch(`${API}/super-admin/billing/stripe`, {
      headers: authHeaders(),
    });
    if (!response.ok) return;
    const body = await response.json();
    setSettings(body.data);
    setPublishableKey(body.data.publishable_key ?? "");
    setMode(body.data.mode ?? "test");
  };

  const loadPlans = async () => {
    const response = await fetch(`${API}/billing/plans`, {
      headers: authHeaders(),
    });
    if (!response.ok) return;
    const body = await response.json();
    setPlans(body.data ?? []);
  };

  const loadTenants = async () => {
    const response = await fetch(`${API}/super-admin/tenants`, {
      headers: authHeaders(),
    });
    if (!response.ok) return;
    const body = await response.json();
    const data: Tenant[] = body.data ?? [];
    setTenants(data);
    if (data.length > 0) {
      setSelectedTenant(String(data[0].id));
    }
  };

  const saveStripeSettings = async () => {
    setSaveStatus("Saving...");
    const response = await fetch(`${API}/super-admin/billing/stripe`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        mode,
        publishable_key: publishableKey,
        secret_key: secretKey || undefined,
        webhook_secret: webhookSecret || undefined,
      }),
    });

    if (!response.ok) {
      setSaveStatus(`Failed (${response.status})`);
      return;
    }

    setSaveStatus("Saved and synced to backend");
    setSecretKey("");
    setWebhookSecret("");
    await loadSettings();
  };

  const loadSubscriptionStatus = async (tenantId: number) => {
    const response = await fetch(`${API}/super-admin/billing/subscription-status?tenant_id=${tenantId}`, {
      headers: authHeaders(),
    });
    if (!response.ok) {
      setSubscriptionStatus(null);
      return;
    }
    const body = await response.json();
    setSubscriptionStatus(body.data ?? null);
  };

  const openBillingPortal = async () => {
    if (!selectedTenant) {
      setPortalStatus("Select a tenant first");
      return;
    }
    setPortalStatus("Creating portal session...");
    const response = await fetch(`${API}/super-admin/billing/portal`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        tenant_id: Number(selectedTenant),
        return_url: window.location.origin + "/billing",
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      setPortalStatus(`Portal failed: ${body.error ?? response.status}`);
      return;
    }
    const url = body?.data?.url as string | undefined;
    if (url) {
      setPortalStatus("Portal ready");
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    setPortalStatus("Portal response received, but URL missing");
  };

  const startSubscription = async (planCode: string) => {
    if (!selectedTenant) {
      setCheckoutStatus("Select a tenant first");
      return;
    }

    setCheckoutStatus("Creating checkout session...");

    const response = await fetch(`${API}/super-admin/billing/subscribe`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        tenant_id: Number(selectedTenant),
        plan_code: planCode,
        success_url: window.location.origin + "/billing/success",
        cancel_url: window.location.origin + "/billing/cancel",
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      setCheckoutStatus(`Checkout failed: ${body.error ?? response.status}`);
      return;
    }

    const url = body?.data?.checkout_url as string | undefined;
    if (url) {
      setCheckoutStatus(`Checkout ready (${body.data.mode})`);
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    setCheckoutStatus("Checkout response received, but URL missing");
  };

  return (
    <section className="billing-admin">
      <h3>Billing and Subscriptions (Stripe)</h3>
      <p className="small-muted">
        Super admin can add Stripe keys here. Frontend syncs settings to backend automatically.
      </p>

      <div className="billing-grid">
        <div className="billing-card">
          <h4>Stripe Keys</h4>
          <label>Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as "test" | "live")}>
            <option value="test">Test</option>
            <option value="live">Live</option>
          </select>

          <label>Publishable Key</label>
          <input
            type="text"
            value={publishableKey}
            onChange={(e) => setPublishableKey(e.target.value)}
            placeholder="pk_test_..."
          />

          <label>Secret Key (optional to update)</label>
          <input
            type="password"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            placeholder="sk_test_..."
          />

          <label>Webhook Secret (optional to update)</label>
          <input
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="whsec_..."
          />

          <button onClick={saveStripeSettings}>Save Stripe Settings</button>
          <p className="small-muted">{saveStatus}</p>
          <p className="small-muted">
            Configured: secret {settings.secret_key_configured ? "yes" : "no"}, webhook {settings.webhook_secret_configured ? "yes" : "no"}
          </p>
        </div>

        <div className="billing-card">
          <h4>Suggested Subscription Fees</h4>
          <p className="small-muted">Recommended monthly pricing in USD:</p>
          <div className="plan-list">
            {plans.map((plan) => (
              <div key={plan.code} className="plan-item">
                <div>
                  <strong>{plan.name}</strong>
                  <p>${(plan.amount_cents / 100).toFixed(0)} / month</p>
                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </div>
                <button onClick={() => startSubscription(plan.code)}>Create Checkout</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="billing-card">
        <h4>Tenant to Charge</h4>
        <select value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)}>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name} ({tenant.slug})
            </option>
          ))}
        </select>
        {subscriptionStatus && (
          <div className="subscription-badge" style={{ marginTop: 8 }}>
            <span className={`status-pill status-${subscriptionStatus.status}`}>
              {subscriptionStatus.status}
            </span>
            <span className="small-muted">
              Plan: {subscriptionStatus.plan_code}
              {subscriptionStatus.trial_ends_at && (
                <> · Trial ends {new Date(subscriptionStatus.trial_ends_at).toLocaleDateString()}</>
              )}
              {subscriptionStatus.current_period_end && (
                <> · Current period ends {new Date(subscriptionStatus.current_period_end).toLocaleDateString()}</>
              )}
            </span>
          </div>
        )}
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <button onClick={openBillingPortal}>Open Billing Portal</button>
        </div>
        <p className="small-muted">{checkoutStatus}</p>
        <p className="small-muted">{portalStatus}</p>
      </div>
    </section>
  );
}
