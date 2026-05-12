import { useEffect, useMemo, useState } from "react";
import "./App.css";
import ReviewMode from "./pages/ReviewMode";
import "./pages/ReviewMode.css";
import TenantSwitcher from "./components/TenantSwitcher";
import InterviewBuddy from "./components/InterviewBuddy";
import ResumeScanner from "./components/ResumeScanner";
import AgentDashboard from "./components/AgentDashboard";
import JobDiscovery from "./components/JobDiscovery";
import BillingAdmin from "./components/BillingAdmin";
import LoginPage from "./components/LoginPage";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";

type Tab = "overview" | "review" | "journeys" | "interview" | "resume" | "agents" | "jobs" | "billing";

type Milestone = {
  code: string;
  label: string;
  status: "todo" | "in_progress" | "done";
  progress_percent: number;
};

type AdminPanel = "command" | "tenants" | "settings" | "users" | "journey";

type TenantRecord = {
  id: number;
  name: string;
  slug: string;
  plan?: string;
  active?: boolean;
};

type UserRecord = {
  id: number;
  name: string;
  email: string;
  role: string;
  tenant_id?: number;
  tenant?: { id: number; name: string };
  created_at?: string;
};

const phaseRows = [
  ["Product Activation", "Onboarding wizard, pre-filled defaults, success milestones", "Medium", "High", "Phase 1"],
  ["Trust & Security", "MFA, secret policy engine, anomaly alerts", "Medium", "High", "Phase 1"],
  ["Review Intelligence", "Explainable AI edits, confidence signals, reviewer notes", "Medium", "High", "Phase 1"],
  ["Automation Resilience", "Adaptive selectors, canary tests, recovery checkpoints", "High", "High", "Phase 1"],
  ["Outcome Analytics", "Funnel and cohort analytics, source ROI, conversion insights", "Medium", "High", "Phase 2"],
  ["Enterprise Controls", "Advanced RBAC, tenant policy packs, compliance exports", "High", "Medium-High", "Phase 2"],
  ["Operational Excellence", "In-app ops panel, automated runbooks, chaos/load testing", "High", "Medium-High", "Phase 2"],
];

const journeys = [
  ["Get Started", "Register tenant and owner", "Faster setup", "Guided onboarding, defaults, milestone checklist"],
  ["Secure Account", "Enable MFA and alerts", "Higher trust", "SMS MFA via Twilio/Sinch, anomaly alert center"],
  ["Tailor Documents", "AI CV and cover letter builder", "More interviews", "Section-level explainability, confidence tags"],
  ["Automate Apply", "Run AI job applier", "Scale with control", "Review checkpoints, canary selector tests"],
  ["Interview Prep", "Mock interview and Interview Buddy", "Improve close rate", "Role-specific drills with feedback scoring"],
  ["Optimize Resume", "Scan and rebuild with same layout", "ATS parity", "Layout-preserving rewrite and ATS diff panel"],
  ["Measure Outcomes", "Track funnels and cohorts", "Data-driven iteration", "Source ROI and conversion analytics"],
];

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("auth_token") ?? "";
  const tenantId = localStorage.getItem("tenant_id") ?? "";

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
  };
}

export default function App() {
  const [tab, setTab] = useState<Tab>("overview");
  const [adminPanel, setAdminPanel] = useState<AdminPanel>("command");
  const [authStatus, setAuthStatus] = useState("Not authenticated");
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [completion, setCompletion] = useState(0);
  const [provider, setProvider] = useState<"twilio" | "sinch">("twilio");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsStatus, setSmsStatus] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem("auth_token"));
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [adminLoadError, setAdminLoadError] = useState("");
  const [tenantSearch, setTenantSearch] = useState("");
  const [impersonatedTenant, setImpersonatedTenant] = useState<TenantRecord | null>(null);

  useEffect(() => {
    fetch(`${API}/platform/capabilities`)
      .then((r) => r.json())
      .then((data) => {
        const features = data?.core_features as string[] | undefined;
        setCapabilities(features ?? []);
      })
      .catch(() => {
        setCapabilities([]);
      });
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;

    fetch(`${API}/auth/me`, { headers: authHeaders() })
      .then(async (response) => {
        if (!response.ok) {
          handleLogout();
          return;
        }

        const body = await response.json();
        setAuthStatus(`Signed in as ${body?.email ?? body?.data?.email ?? "admin"}`);

        loadMilestones().catch(() => {
          setAuthStatus("Signed in, but milestones could not be loaded");
        });

        loadAdminData();
      })
      .catch(() => {
        handleLogout();
      });
  }, [isLoggedIn]);

  const loadMilestones = async () => {
    const response = await fetch(`${API}/onboarding/milestones`, { headers: authHeaders() });
    if (!response.ok) {
      throw new Error(`Milestones failed (${response.status})`);
    }

    const body = await response.json();
    setMilestones(body.data ?? []);
    setCompletion(body.completion_percent ?? 0);
  };

  const loadAdminData = async () => {
    setAdminLoadError("");
    try {
      const [tenantsResp, usersResp] = await Promise.all([
        fetch(`${API}/super-admin/tenants`, { headers: authHeaders() }),
        fetch(`${API}/super-admin/users`, { headers: authHeaders() }),
      ]);

      if (tenantsResp.ok) {
        const tenantsBody = await tenantsResp.json();
        setTenants(tenantsBody.data ?? []);
      }

      if (usersResp.ok) {
        const usersBody = await usersResp.json();
        setUsers(usersBody.data ?? []);
      }

      if (!tenantsResp.ok && !usersResp.ok) {
        setAdminLoadError("Super admin data is unavailable for this account.");
      }
    } catch {
      setAdminLoadError("Could not load admin data.");
    }
  };

  const handleLogin = (token: string, tenantId: string, tenantSlug: string, email: string) => {
    localStorage.setItem("auth_token", token);
    localStorage.setItem("tenant_id", tenantId);
    localStorage.setItem("tenant_slug", tenantSlug);
    setAuthStatus(`Signed in as ${email}`);
    setIsLoggedIn(true);
    loadMilestones().catch(() => {
      setAuthStatus("Signed in, but milestones could not be loaded");
    });
    loadAdminData();
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("tenant_id");
    localStorage.removeItem("tenant_slug");
    setIsLoggedIn(false);
    setAuthStatus("Not authenticated");
    setMilestones([]);
    setCompletion(0);
    setImpersonatedTenant(null);
  };

  const impersonateTenant = (tenant: TenantRecord) => {
    localStorage.setItem("tenant_id", String(tenant.id));
    localStorage.setItem("tenant_slug", tenant.slug);
    setImpersonatedTenant(tenant);
    setAuthStatus(`Impersonating ${tenant.name} (ID: ${tenant.id})`);
    setTab("overview");
    setAdminPanel("command");
    loadMilestones().catch(() => {});
  };

  const stopImpersonation = () => {
    localStorage.removeItem("tenant_id");
    localStorage.removeItem("tenant_slug");
    setImpersonatedTenant(null);
    setAuthStatus("Signed in as superadmin@local.dev");
    loadMilestones().catch(() => {});
  };

  const updateMilestone = async (code: string, status: Milestone["status"]) => {
    const response = await fetch(`${API}/onboarding/milestones/${code}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });

    if (response.ok) {
      await loadMilestones();
    }
  };

  const sendAnomalyAlert = async () => {
    if (!phoneNumber) {
      setSmsStatus("Enter a phone number first");
      return;
    }

    const response = await fetch(`${API}/security/anomaly-alert`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        phone_number: phoneNumber,
        provider,
        message: "Security anomaly check from Super Admin panel",
      }),
    });

    if (!response.ok) {
      setSmsStatus(`SMS failed (${response.status})`);
      return;
    }

    const body = await response.json();
    setSmsStatus(`Alert sent via ${body.data?.provider} with status ${body.data?.status}`);
  };

  const milestoneProgress = useMemo(() => {
    if (milestones.length === 0) return 0;
    return Math.round((milestones.filter((m) => m.status === "done").length / milestones.length) * 100);
  }, [milestones]);

  const filteredTenants = useMemo(() => {
    const query = tenantSearch.trim().toLowerCase();
    if (!query) return tenants;
    return tenants.filter((tenant) => `${tenant.name} ${tenant.slug}`.toLowerCase().includes(query));
  }, [tenantSearch, tenants]);

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="theme-shell admin-shell">
      <header className="admin-topbar">
        <div>
          <p className="eyebrow">PROJOBS Super Admin</p>
          <h1>Operations Console</h1>
          <p className="hero-copy">Manage tenants, platform settings, user experience, and billing from one place.</p>
        </div>
        <div className="admin-top-actions">
          <div className="admin-pill">{authStatus}</div>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="admin-layout">
        <aside className="admin-sidebar">
          <h3>Admin Panels</h3>
          <button className={adminPanel === "command" ? "active" : ""} onClick={() => setAdminPanel("command")}>Command Center</button>
          <button className={adminPanel === "tenants" ? "active" : ""} onClick={() => setAdminPanel("tenants")}>Tenant Management</button>
          <button className={adminPanel === "settings" ? "active" : ""} onClick={() => setAdminPanel("settings")}>Platform Settings</button>
          <button className={adminPanel === "users" ? "active" : ""} onClick={() => setAdminPanel("users")}>User Activity</button>
          <button className={adminPanel === "journey" ? "active" : ""} onClick={() => setAdminPanel("journey")}>User Journey Preview</button>

          <h3 className="sidebar-title">User Workspace</h3>
          <button className={tab === "review" ? "active" : ""} onClick={() => setTab("review")}>Review Mode</button>
          <button className={tab === "resume" ? "active" : ""} onClick={() => setTab("resume")}>Resume Scanner</button>
          <button className={tab === "jobs" ? "active" : ""} onClick={() => setTab("jobs")}>Job Discovery</button>
          <button className={tab === "interview" ? "active" : ""} onClick={() => setTab("interview")}>Interview Buddy</button>
          <button className={tab === "agents" ? "active" : ""} onClick={() => setTab("agents")}>Agents</button>
          <button className={tab === "billing" ? "active" : ""} onClick={() => setTab("billing")}>Billing</button>
          <button className={tab === "journeys" ? "active" : ""} onClick={() => setTab("journeys")}>Journey Table</button>

          {impersonatedTenant && (
            <div className="impersonation-bar">
              <span>👤 {impersonatedTenant.name}</span>
              <button onClick={stopImpersonation}>Stop</button>
            </div>
          )}
        </aside>

        <main className="admin-main">
          {tab === "overview" && adminPanel === "command" && (
            <div className="admin-grid">
              <section className="card">
                <h3>Execution Snapshot</h3>
                <div className="chips">
                  <span>Activation {completion || milestoneProgress}%</span>
                  <span>{tenants.length} Tenants</span>
                  <span>{users.length} Users</span>
                  <span>{capabilities.length} Capabilities</span>
                </div>
                <p className="small-muted">Use this panel to quickly monitor rollout health and feature readiness.</p>
              </section>

              <section className="card">
                <h3>Product Activation Milestones</h3>
                {milestones.length === 0 && <p className="small-muted">No milestones loaded yet.</p>}
                <div className="milestones">
                  {milestones.map((milestone) => (
                    <div key={milestone.code} className="milestone-row">
                      <div>
                        <strong>{milestone.label}</strong>
                        <p>{milestone.code}</p>
                      </div>
                      <select
                        value={milestone.status}
                        onChange={(e) => updateMilestone(milestone.code, e.target.value as Milestone["status"])}
                      >
                        <option value="todo">Todo</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                  ))}
                </div>
              </section>

              <section className="card full">
                <h3>Roadmap</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Theme</th>
                      <th>Scope</th>
                      <th>Effort</th>
                      <th>Impact</th>
                      <th>Phase</th>
                    </tr>
                  </thead>
                  <tbody>
                    {phaseRows.map((row) => (
                      <tr key={row[0]}>
                        <td>{row[0]}</td>
                        <td>{row[1]}</td>
                        <td>{row[2]}</td>
                        <td>{row[3]}</td>
                        <td>{row[4]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          )}

          {tab === "overview" && adminPanel === "tenants" && (
            <section className="card">
              <h3>Tenant Management</h3>
              <p className="small-muted">View and manage tenant metadata. Search by tenant name or slug.</p>
              <div className="admin-toolbar">
                <input
                  type="text"
                  placeholder="Search tenants"
                  value={tenantSearch}
                  onChange={(e) => setTenantSearch(e.target.value)}
                />
                <button onClick={loadAdminData}>Refresh</button>
              </div>

              {adminLoadError && <p className="error">{adminLoadError}</p>}

              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Slug</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.map((tenant) => (
                    <tr key={tenant.id}>
                      <td>{tenant.id}</td>
                      <td>{tenant.name}</td>
                      <td>{tenant.slug}</td>
                      <td>{tenant.plan ?? "starter"}</td>
                      <td>{tenant.active === false ? "Inactive" : "Active"}</td>
                      <td>
                        <div className="table-actions">
                          <button onClick={() => impersonateTenant(tenant)}>Impersonate</button>
                          <button onClick={() => setTab("billing")}>Billing</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredTenants.length === 0 && (
                    <tr>
                      <td colSpan={6}>No tenants found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

          {tab === "overview" && adminPanel === "settings" && (
            <div className="admin-grid">
              <section className="card">
                <h3>Platform Capabilities</h3>
                <div className="chips">
                  {capabilities.map((capability) => (
                    <span key={capability}>{capability}</span>
                  ))}
                </div>
              </section>

              <section className="card">
                <h3>Security Alert Test</h3>
                <div className="sms-row">
                  <select value={provider} onChange={(e) => setProvider(e.target.value as "twilio" | "sinch")}>
                    <option value="twilio">Twilio SMS</option>
                    <option value="sinch">SinchMedia SMS</option>
                  </select>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+61400000000"
                  />
                  <button onClick={sendAnomalyAlert}>Send Test Alert</button>
                </div>
                <p className="small-muted">{smsStatus || "No alert sent yet."}</p>
              </section>

              <section className="card full">
                <h3>Billing & Subscription Controls</h3>
                <p className="small-muted">Manage Stripe keys, checkout, and plan controls in the Billing module.</p>
                <button onClick={() => setTab("billing")}>Open Billing Console</button>
              </section>
            </div>
          )}

          {tab === "overview" && adminPanel === "users" && (
            <section className="card">
              <h3>User Activity</h3>
              <p className="small-muted">Recent users and their tenant/role assignments.</p>
              {adminLoadError && <p className="error">{adminLoadError}</p>}
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Tenant</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>{user.role}</td>
                      <td>{user.tenant?.name ?? `Tenant #${user.tenant_id ?? "-"}`}</td>
                      <td>{user.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}</td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5}>No user activity to display.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

          {tab === "overview" && adminPanel === "journey" && (
            <div className="admin-grid">
              <section className="card full">
                <h3>How End Users Experience PROJOBS</h3>
                <div className="journey-steps">
                  <button onClick={() => setTab("resume")}>1. Resume Scanner</button>
                  <button onClick={() => setTab("jobs")}>2. Job Discovery</button>
                  <button onClick={() => setTab("agents")}>3. AI Apply / Agents</button>
                  <button onClick={() => setTab("review")}>4. Review Queue</button>
                  <button onClick={() => setTab("interview")}>5. Interview Buddy</button>
                  <button onClick={() => setTab("journeys")}>6. Journey Analytics</button>
                </div>
                <p className="small-muted">Select a step to jump into that user-facing module instantly.</p>
              </section>

              <section className="card full">
                <h3>Journey Improvement Backlog</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Journey</th>
                      <th>Current Step</th>
                      <th>Goal</th>
                      <th>Improvement Plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journeys.map((row) => (
                      <tr key={row[0]}>
                        <td>{row[0]}</td>
                        <td>{row[1]}</td>
                        <td>{row[2]}</td>
                        <td>{row[3]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          )}

          {tab === "review" && <ReviewMode />}
          {tab === "interview" && <InterviewBuddy />}
          {tab === "resume" && <ResumeScanner />}
          {tab === "jobs" && <JobDiscovery />}
          {tab === "agents" && <AgentDashboard />}
          {tab === "billing" && <BillingAdmin />}
          {tab === "journeys" && (
            <section className="card full">
              <h3>User Journeys and Improvements</h3>
              <table>
                <thead>
                  <tr>
                    <th>Journey</th>
                    <th>Current Step</th>
                    <th>Goal</th>
                    <th>Improvement Plan</th>
                  </tr>
                </thead>
                <tbody>
                  {journeys.map((row) => (
                    <tr key={row[0]}>
                      <td>{row[0]}</td>
                      <td>{row[1]}</td>
                      <td>{row[2]}</td>
                      <td>{row[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </main>
      </div>

      <TenantSwitcher />
    </div>
  );
}
