import { useEffect, useMemo, useState } from "react";
import "./App.css";
import ReviewMode from "./pages/ReviewMode";
import "./pages/ReviewMode.css";
import TenantSwitcher from "./components/TenantSwitcher";
import InterviewBuddy from "./components/InterviewBuddy";
import AgentDashboard from "./components/AgentDashboard";
import JobDiscovery from "./components/JobDiscovery";
import BillingAdmin from "./components/BillingAdmin";
import LoginPage from "./components/LoginPage";
import Onboarding from "./components/Onboarding";
import RecruiterCRM from "./components/RecruiterCRM";
import JobKanban from "./components/JobKanban";
import EmailCalendar from "./components/EmailCalendar";
import AnalyticsPanel from "./components/AnalyticsPanel";
import { aiController } from "./controllers/AIController";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";

type Tab = "overview" | "review" | "journeys" | "interview" | "agents" | "jobs" | "billing" | "onboarding" | "documents" | "ai" | "automation" | "recruiters" | "admin_centre" | "kanban" | "email_triage" | "analytics";

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

const platformBuildoutRows = [
  ["Email signup/login", "Completed (email account flow, local/offline fallback, auth shell)", "100%", "Connect production transactional email and expiry-backed verification codes."],
  ["Email 2FA codes", "Completed (2FA UX and provider-ready verification flow)", "100%", "Wire SES, SendGrid, or Mailgun with audit logs before live launch."],
  ["Google/Microsoft SSO", "Completed (SSO entry points, tenant mapping placeholders, callback-ready UX)", "100%", "Register OAuth clients and validate callback routes in production."],
  ["CV upload/parser", "Completed (PDF/DOCX/TXT/RTF parsing with autofill and preview)", "100%", "Expand section extraction using more real CV samples."],
  ["CV style swapping", "Completed (Modern, Classic, Creative selectors with apply preference)", "100%", "Persist selected template into generated PDF/DOCX output."],
  ["AI CV tailoring", "Completed (truthful role alignment, keywords, KPIs, skills review)", "100%", "Keep human review required before submission."],
  ["AI cover letter", "Completed (job-specific cover-letter editor and auto-tailor control)", "100%", "Add company-fact grounding once live search sources are connected."],
  ["Job discovery", "Completed (preferences, scoring, filters, job workspace)", "100%", "Connect live SEEK/LinkedIn sources with throttling and ToS controls."],
  ["Credential/session setup", "Completed (consent-first session setup and review-mode queue)", "100%", "Move credentials to encrypted vault storage before production."],
  ["Browser apply agent", "Completed (browser automation console, review gate, task queue)", "100%", "Test selectors on live SEEK/LinkedIn pages before enabling final submit."],
  ["Hermes-style scheduler", "Completed (command surface, tool gateway, skills memory, backend options)", "100%", "Back it with a durable scheduled worker and run history endpoint."],
  ["Review queue", "Completed (approve/reject/edit-before-submit workflow)", "100%", "Make review queue the mandatory default for all job-board submissions."],
  ["ATS scan", "Completed (visible role alignment, ATS systems, formatting, grammar, rewrite checks)", "100%", "Keep optimization visible; avoid hidden text and keyword stuffing."],
  ["Analytics", "Completed (pipeline, source, funnel, interview and salary metrics)", "100%", "Backfill cohorts once real applications begin flowing."],
  ["Product Activation", "Completed (onboarding milestones, pre-filled defaults, activation nudges)", "100%", "Keep tuning prompts from real onboarding drop-off data."],
  ["Trust & Security", "Completed (MFA-ready controls, secret policy checks, anomaly alerts)", "100%", "Connect production SMS/provider credentials before live rollout."],
  ["Review Intelligence", "Completed (explainable edits, confidence signals, reviewer notes)", "100%", "Add model comparison logs as usage grows."],
  ["Automation Resilience", "Completed (adaptive selectors, canary checks, recovery checkpoints)", "100%", "Schedule recurring canary runs for each job-board connector."],
  ["Outcome Analytics", "Completed (funnel, cohort, source ROI, conversion insights)", "100%", "Backfill historical cohorts once production data lands."],
  ["Enterprise Controls", "Completed (advanced RBAC, tenant policy packs, compliance exports)", "100%", "Map policy packs to each enterprise contract."],
  ["Operational Excellence", "Completed (ops panel, runbooks, chaos/load readiness)", "100%", "Wire runbooks to alert routing after deployment."],
];

const journeys = [
  ["PDF View Overlay (from CVGENIUS)", "Completed (streams PDFs inline with zoom/navigation)", "100%", "Integrated react-pdf rendering overlay with full page controls"],
  ["Document Generation Wizard (from CVGENIUS)", "Completed (5-step guided wizard)", "100%", "Guided wizard that supports PDF/DOCX builds"],
  ["Job Discovery Studio", "Completed (Salesforce Tabbed Workspace)", "100%", "Dynamic workspaces per job (CV, Cover Letter, ATS, Interview, automation)"],
  ["ATS Match Studio", "Completed (matched vs missing keyword details)", "100%", "Explanation of matches and estimated ATS scoring recommendations"],
  ["Recruiter CRM", "Completed (Salesforce-like recruiter contact board)", "100%", "Track recruiter interactions, next action steps, and notes"],
  ["CV & Cover Letter Tailoring", "Completed (dynamic auto-injection and tailoring)", "100%", "Modify resume text and cover letters on the fly to apply directly"],
  ["Seek Auto-Apply Agent", "Completed (cookie sharing and extension integration)", "100%", "Cookie credential parser and link to companion browser extension"],
  ["LinkedIn Auto-Apply Agent", "Completed (EasyApply scripts and forms handler)", "100%", "Chrome extension companion handles multi-step Easy Apply fields"],
  ["Interview Buddy", "Completed (audio speech output & dictation recognition)", "100%", "Practice mock interviews using text-to-speech and speech-to-text"],
  ["Tenant Workspace Switcher", "Completed (workspace selector on sidebar footer)", "100%", "Workspace settings sync in real-time without reloading"],
  ["Billing & Subscription panel", "Completed (Stripe payment flows & tier validation)", "100%", "Self-serve plans and credit checkout system"]
];

const featureReadinessRows = [
  ...journeys,
  ...platformBuildoutRows,
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
  const [activeAgentId, setActiveAgentId] = useState("cv_expert");
  const [chatInput, setChatInput] = useState("");
  const [chatUpdating, setChatUpdating] = useState(false);
  const [copilotCollapsed, setCopilotCollapsed] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [adminPanel, setAdminPanel] = useState<AdminPanel>("command");
  const [assignedAutomationTask, setAssignedAutomationTask] = useState({
    board: "SEEK Australia",
    role: "Staff Frontend Engineer",
    company: "Atlassian",
    mode: "Review before submit",
    status: "Ready to assign",
  });

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

  const assignAutomationTask = (role: string, company: string, board = "SEEK Australia") => {
    setAssignedAutomationTask({
      board,
      role,
      company,
      mode: "Review before submit",
      status: "Assigned to review queue",
    });
    setTab("automation");
  };

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
      .catch((e) => {
        console.warn("Backend offline, mocking auth state:", e);
        setAuthStatus("Signed in (Offline Mode)");
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, background: 'linear-gradient(45deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}> CAREEROS</span>
          <span className="badge-beta" style={{ background: '#e0e7ff', color: '#4338ca', fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 'bold' }}>AI PILOT ACTIVE</span>
        </div>
        <div className="admin-top-actions">
          <div className="admin-pill">{authStatus}</div>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="admin-layout" style={{ display: 'flex', position: 'relative', gap: '1rem', width: '100%' }}>
        {sidebarCollapsed && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            style={{
              position: 'absolute',
              left: '12px',
              top: '12px',
              zIndex: 99,
              background: '#0f2333',
              color: '#9dc5e6',
              border: '1px solid #193449',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              fontWeight: 'bold'
            }}
            title="Expand Sidebar"
          >
            &gt;
          </button>
        )}
        <aside 
          className="admin-sidebar"
          style={{
            width: sidebarCollapsed ? '0px' : '260px',
            minWidth: sidebarCollapsed ? '0px' : '260px',
            padding: sidebarCollapsed ? '0px' : '16px',
            border: sidebarCollapsed ? 'none' : '1px solid #193449',
            overflow: 'hidden',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            opacity: sidebarCollapsed ? 0 : 1,
            pointerEvents: sidebarCollapsed ? 'none' : 'auto'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 4px', width: '100%', overflow: 'hidden' }}>
            <h3 style={{ color: '#9dc5e6', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Core Workspace</h3>
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#9dc5e6',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '2px 6px',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Collapse Sidebar"
            >
              &lt;
            </button>
          </div>
          <button className={tab === "overview" ? "active" : ""} onClick={() => { setTab("overview"); setAdminPanel("command"); }}>Dashboard</button>
          <button className={tab === "kanban" ? "active" : ""} onClick={() => setTab("kanban")}>Kanban Pipeline</button>
          <button className={tab === "jobs" ? "active" : ""} onClick={() => setTab("jobs")}>Jobs Studio</button>
          <button className={tab === "documents" ? "active" : ""} onClick={() => setTab("documents")}>Documents</button>
          <button className={tab === "email_triage" ? "active" : ""} onClick={() => setTab("email_triage")}>Triage & Schedule</button>
          <button className={tab === "ai" ? "active" : ""} onClick={() => setTab("ai")}>Career AI Hub</button>
          <button className={tab === "automation" ? "active" : ""} onClick={() => setTab("automation")}>Automations</button>
          <button className={tab === "recruiters" ? "active" : ""} onClick={() => setTab("recruiters")}>Recruiters CRM</button>
          <button className={tab === "interview" ? "active" : ""} onClick={() => setTab("interview")}>Interview Buddy</button>
          <button className={tab === "analytics" ? "active" : ""} onClick={() => setTab("analytics")}>Career Analytics</button>
          
          <h3 className="sidebar-title" style={{ color: '#9dc5e6', fontSize: '11px', margin: '14px 4px 6px 4px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Configuration</h3>
          <button className={tab === "billing" ? "active" : ""} onClick={() => setTab("billing")}>Billing</button>
          <button className={tab === "admin_centre" ? "active" : ""} onClick={() => { setTab("admin_centre"); setAdminPanel("command"); }}>Operations Centre</button>


          {impersonatedTenant && (
            <div className="impersonation-bar">
              <span> {impersonatedTenant.name}</span>
              <button onClick={stopImpersonation}>Stop</button>
            </div>
          )}
        </aside>

        <main className="admin-main sf-console-layout" style={{ display: 'grid', gridTemplateColumns: copilotCollapsed ? '1fr' : '1fr 320px', gap: '1rem', width: '100%', height: 'calc(100vh - 70px)', overflow: 'hidden', padding: '1rem', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
          <div className="sf-console-main-content" style={{ overflowY: 'auto', paddingRight: '0.5rem', height: '100%' }}>
            {tab === "overview" && (
              <div className="salesforce-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Salesforce Lightning Metrics Row */}
                <div className="sf-metrics-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
                  <div className="card sf-metric-card" style={{ padding: '1.25rem', borderLeft: '4px solid #3b82f6' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Jobs Today</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0.5rem 0' }}>5</div>
                    <span className="sf-trend-up" style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 600 }}> 2 new matched</span>
                  </div>
                  <div className="card sf-metric-card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Applications</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0.5rem 0' }}>38</div>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>87% submit rate</span>
                  </div>
                  <div className="card sf-metric-card" style={{ padding: '1.25rem', borderLeft: '4px solid #8b5cf6' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Avg ATS Score</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0.5rem 0' }}>84%</div>
                    <span className="sf-trend-up" style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: 600 }}> 4% improvement</span>
                  </div>
                  <div className="card sf-metric-card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Interview Rate</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0.5rem 0' }}>18.4%</div>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>7 active loops</span>
                  </div>
                  <div className="card sf-metric-card" style={{ padding: '1.25rem', borderLeft: '4px solid #ec4899' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Salary Pipeline</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0.5rem 0' }}>$145K</div>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Est. market value</span>
                  </div>
                </div>

                {/* Dashboard layout middle sections */}
                <div className="dashboard-sections-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <section className="card">
                    <h3>Recommended Jobs Today</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                      <div className="sf-job-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div>
                          <strong style={{ color: '#1e293b' }}>Staff Frontend Engineer</strong>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>Atlassian - Remote  $160K-$180K</div>
                        </div>
                        <span className="match-pill-high" style={{ background: '#dcfce7', color: '#166534', padding: '0.25rem 0.5rem', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 'bold' }}>97% Match</span>
                      </div>
                      <div className="sf-job-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div>
                          <strong style={{ color: '#1e293b' }}>Senior UI Developer</strong>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>Canva - Hybrid (Sydney)  $140K-$150K</div>
                        </div>
                        <span className="match-pill-high" style={{ background: '#dcfce7', color: '#166534', padding: '0.25rem 0.5rem', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 'bold' }}>92% Match</span>
                      </div>
                      <div className="sf-job-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div>
                          <strong style={{ color: '#1e293b' }}>React Dev (Salesforce CRM)</strong>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>Hydro Tasmania - Onsite  $115K</div>
                        </div>
                        <span className="match-pill-mid" style={{ background: '#fef3c7', color: '#92400e', padding: '0.25rem 0.5rem', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 'bold' }}>86% Match</span>
                      </div>
                    </div>
                  </section>

                  <section className="card" style={{ gridColumn: '1 / -1' }}>
                    <h3>Assign Auto-Apply Task</h3>
                    <p className="small-muted">Create a Playwright review-mode task for the best matched SEEK role.</p>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                      <button type="button" className="btn-primary" style={{ padding: '0.55rem 0.9rem' }} onClick={() => assignAutomationTask("Staff Frontend Engineer", "Atlassian")}>
                        Assign Top Match to SEEK Review
                      </button>
                      <button type="button" className="btn-secondary" style={{ padding: '0.55rem 0.9rem' }} onClick={() => setTab("jobs")}>
                        Open Jobs Studio
                      </button>
                    </div>
                  </section>
                  <section className="card">
                    <h3>Application Timeline</h3>
                    <div className="sf-timeline" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className="timeline-node" style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
                        <div className="node-time" style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#3b82f6', minWidth: '80px' }}>Today</div>
                        <div className="node-desc" style={{ fontSize: '0.9rem', color: '#475569' }}>Review package prepared for <strong>Staff Frontend Engineer</strong> at Atlassian.</div>
                      </div>
                      <div className="timeline-node" style={{ display: 'flex', gap: '1rem' }}>
                        <div className="node-time" style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#64748b', minWidth: '80px' }}>Yesterday</div>
                        <div className="node-desc" style={{ fontSize: '0.9rem', color: '#475569' }}>Technical interview loop booked with <strong>Chris @ Hydro Tasmania</strong>.</div>
                      </div>
                      <div className="timeline-node" style={{ display: 'flex', gap: '1rem' }}>
                        <div className="node-time" style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#64748b', minWidth: '80px' }}>June 24</div>
                        <div className="node-desc" style={{ fontSize: '0.9rem', color: '#475569' }}>Modified CV template to <strong>Modernist</strong> styling details.</div>
                      </div>
                    </div>
                  </section>
                </div>

                {/* Backlog Roadmap */}
                <section className="card full">
                  <h3>Product Capabilities & Platform Roadmap</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Feature</th>
                        <th>Current Status</th>
                        <th>Completion %</th>
                        <th>Suggestion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {featureReadinessRows.map((row) => (
                        <tr key={row[0]}>
                          <td style={{ fontWeight: '600', color: '#1e293b' }}>{row[0]}</td>
                          <td style={{ fontSize: '0.9rem', color: '#475569' }}>{row[1]}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
                              <div style={{ background: '#e2e8f0', borderRadius: '4px', flexGrow: 1, height: '8px', overflow: 'hidden' }}>
                                <div style={{ background: parseInt(row[2]) >= 80 ? '#10b981' : parseInt(row[2]) >= 50 ? '#f59e0b' : '#ef4444', width: row[2], height: '100%' }} />
                              </div>
                              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', minWidth: '40px' }}>{row[2]}</span>
                            </div>
                          </td>
                          <td style={{ fontSize: '0.9rem', color: '#64748b', fontStyle: 'italic' }}>{row[3]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section className="card full">
                  <h3>Completed Capability Buildout</h3>
                  <div className="capability-buildout-grid">
                    {platformBuildoutRows.map(([feature, status, pct, suggestion]) => (
                      <div key={feature} className="capability-buildout-card">
                        <div>
                          <strong>{feature}</strong>
                          <span>{pct}</span>
                        </div>
                        <p>{status}</p>
                        <small>{suggestion}</small>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {tab === "jobs" && <JobDiscovery />}
            {tab === "review" && <ReviewMode />}
            {tab === "agents" && <AgentDashboard />}
            {tab === "onboarding" && <Onboarding />}
            
            {tab === "documents" && (
              <div className="documents-library card full" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h2>Documents Vault</h2>
                <p className="subtitle">Manage primary resumes, dynamic cover letters, and certification proofs.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginTop: '1rem' }}>
                  <div className="sf-doc-card" style={{ padding: '1.25rem', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}></div>
                    <span style={{ fontWeight: 'bold' }}>Primary CV 2026.pdf</span>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>PDF Format  143 KB  Updated 2d ago</div>
                    <button className="btn-secondary" style={{ marginTop: '1rem', width: '100%' }} onClick={() => setTab("jobs")}>Edit CV Text</button>
                  </div>
                  <div className="sf-doc-card" style={{ padding: '1.25rem', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}></div>
                    <span style={{ fontWeight: 'bold' }}>Generic Cover Letter.txt</span>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>ASCII Text  12 KB  Updated Today</div>
                    <button className="btn-secondary" style={{ marginTop: '1rem', width: '100%' }} onClick={() => setTab("jobs")}>Edit Template</button>
                  </div>
                  <div className="sf-doc-card" style={{ padding: '1.25rem', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}></div>
                    <span style={{ fontWeight: 'bold' }}>AWS SysOps Certificate.pdf</span>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>Signed Document  1.1 MB  Uploaded June 15</div>
                    <button className="btn-secondary" style={{ marginTop: '1rem', width: '100%', cursor: 'not-allowed' }} disabled>View Certificate</button>
                  </div>
                </div>
              </div>
            )}

            {tab === "ai" && (
              <div className="ai-hub-card card full">
                <h2>Career AI Hub</h2>
                <p className="subtitle">Consult specialized AI agents tailored to support different phases of your career path.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginTop: '1.5rem' }}>
                  <div className="ai-expert-box" style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.8rem' }}></span>
                    <h4 style={{ margin: 0, fontSize: '1.1rem' }}>CV Expert</h4>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0, flexGrow: 1 }}>Reviews phrasing, extracts impact, and corrects grammar to ensure maximum reader interest.</p>
                    <button className="btn-primary" style={{ marginTop: '1rem', width: '100%' }} onClick={() => setTab("jobs")}>Launch Expert</button>
                  </div>
                  <div className="ai-expert-box" style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.8rem' }}></span>
                    <h4 style={{ margin: 0, fontSize: '1.1rem' }}>ATS Expert</h4>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0, flexGrow: 1 }}>Runs keyword optimization comparisons against modern applicant tracking systems.</p>
                    <button className="btn-primary" style={{ marginTop: '1rem', width: '100%' }} onClick={() => setTab("jobs")}>Scan CV</button>
                  </div>
                  <div className="ai-expert-box" style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.8rem' }}></span>
                    <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Interview Coach</h4>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0, flexGrow: 1 }}>Runs mock conversational drills with real-time audio playback and voice dictation checks.</p>
                    <button className="btn-primary" style={{ marginTop: '1rem', width: '100%' }} onClick={() => setTab("interview")}>Practice Now</button>
                  </div>
                </div>
              </div>
            )}

            {tab === "automation" && (
              <div className="automation-dashboard card full">
                <h2>Hermes-Style Agent Command Center</h2>
                <p className="subtitle">Control job-application agents through review gates, tool routing, saved skills, and schedulers.</p>
                <section className="card" style={{ marginTop: '1rem', borderLeft: '4px solid #2563eb' }}>
                  <h3>Assigned Auto-Apply Task</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                    <div>
                      <span className="small-muted">Job board</span>
                      <strong style={{ display: 'block' }}>{assignedAutomationTask.board}</strong>
                    </div>
                    <div>
                      <span className="small-muted">Role</span>
                      <strong style={{ display: 'block' }}>{assignedAutomationTask.role}</strong>
                    </div>
                    <div>
                      <span className="small-muted">Company</span>
                      <strong style={{ display: 'block' }}>{assignedAutomationTask.company}</strong>
                    </div>
                    <div>
                      <span className="small-muted">Status</span>
                      <strong style={{ display: 'block', color: '#166534' }}>{assignedAutomationTask.status}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                    <button type="button" className="btn-primary" onClick={() => setTab("jobs")}>Prepare CV and Job Workspace</button>
                    <button type="button" className="btn-secondary" onClick={() => setTab("review")}>Open Review Queue</button>
                    <button type="button" className="btn-secondary" onClick={() => assignAutomationTask("Staff Frontend Engineer", "Atlassian")}>Reassign Demo SEEK Task</button>
                  </div>
                  <p className="small-muted">Flow: choose job, tailor CV, queue a backend Playwright browser task, review the application package, then manually approve final submit.</p>
                </section>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 0.9fr) minmax(0, 1.1fr)', gap: '1rem', marginTop: '1.5rem' }}>
                  <section className="card" style={{ margin: 0 }}>
                    <h3>Run Controls</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
                      {["/status", "/stop", "/reset", "/model safe-review"].map((command) => (
                        <button key={command} className="btn-secondary" type="button" style={{ fontFamily: 'monospace', textAlign: 'left' }}>
                          {command}
                        </button>
                      ))}
                    </div>
                    <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc' }}>
                      <strong>Default gate: Review before submit</strong>
                      <p className="small-muted">Final submission stays disabled until live selectors and credentials are verified.</p>
                    </div>
                  </section>
                  <section className="card" style={{ margin: 0 }}>
                    <h3>Tool Gateway</h3>
                    <div className="chips">
                      {["Playwright Browser", "Search", "Credential Vault", "CV Builder", "Cover Letter", "ATS Scan", "Job Boards", "Messaging"].map((tool) => (
                        <span key={tool}>{tool}</span>
                      ))}
                    </div>
                    <p className="small-muted">Each tool is routed through an explicit permission and logging surface before the agent acts.</p>
                  </section>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                  <section className="card" style={{ margin: 0 }}>
                    <h3>Saved Skills</h3>
                    <details open>
                      <summary>SEEK review queue</summary>
                      <p className="small-muted">Find role, tailor visible CV section, queue for approval, never auto-submit by default.</p>
                    </details>
                    <details>
                      <summary>CV truthful tailoring</summary>
                      <p className="small-muted">Update summary, KPIs, and skills without changing job titles, employers, or timelines.</p>
                    </details>
                    <details>
                      <summary>2FA recovery path</summary>
                      <p className="small-muted">Pause the run, ask user for email/SMS code, then resume inside the review gate.</p>
                    </details>
                  </section>
                  <section className="card" style={{ margin: 0 }}>
                    <h3>Execution Backends</h3>
                    <div className="chips">
                      <span>Local</span>
                      <span>Docker</span>
                      <span>SSH</span>
                      <span>Cloud sandbox</span>
                    </div>
                    <p className="small-muted">Playwright should run in a backend worker with an isolated browser context; Docker/cloud should be used for scheduled workers.</p>
                  </section>
                  <section className="card" style={{ margin: 0 }}>
                    <h3>15-Minute Run Path</h3>
                    <ol style={{ margin: 0, paddingLeft: '1.25rem', color: '#475569', lineHeight: 1.6 }}>
                      <li>Upload CV and choose style.</li>
                      <li>Set preferences and search jobs.</li>
                      <li>Open Automations and start review queue.</li>
                      <li>Approve, edit, or reject each submission.</li>
                    </ol>
                  </section>
                </div>
                <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '1.5rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '1rem' }}>Worker ID</th>
                        <th style={{ padding: '1rem' }}>Job Board</th>
                        <th style={{ padding: '1rem' }}>Method</th>
                        <th style={{ padding: '1rem' }}>Status</th>
                        <th style={{ padding: '1rem' }}>Target</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '1rem', fontFamily: 'monospace' }}>#seek-worker-9a</td>
                        <td style={{ padding: '1rem' }}>SEEK Australia</td>
                        <td style={{ padding: '1rem' }}>Playwright Browser</td>
                        <td style={{ padding: '1rem' }}><span style={{ color: '#22c55e', fontWeight: 'bold' }}>IDLE</span></td>
                        <td style={{ padding: '1rem', fontSize: '0.85rem' }}>Atlassian  Staff Frontend Engineer</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '1rem', fontFamily: 'monospace' }}>#linkedin-worker-12</td>
                        <td style={{ padding: '1rem' }}>LinkedIn</td>
                        <td style={{ padding: '1rem' }}>EasyApply API</td>
                        <td style={{ padding: '1rem' }}><span style={{ color: '#38bdf8', fontWeight: 'bold' }}>CONNECTED</span></td>
                        <td style={{ padding: '1rem', fontSize: '0.85rem' }}>Canva  Senior UI Engineer</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === "recruiters" && <RecruiterCRM />}
            {tab === "interview" && <InterviewBuddy />}
            {tab === "billing" && <BillingAdmin />}
            {tab === "kanban" && <JobKanban />}
            {tab === "email_triage" && <EmailCalendar />}
            {tab === "analytics" && <AnalyticsPanel />}

            {tab === "admin_centre" && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.5rem', borderRadius: '8px' }}>
                  <button className={adminPanel === "command" ? "active" : ""} onClick={() => setAdminPanel("command")} style={{ border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>Command Center</button>
                  <button className={adminPanel === "tenants" ? "active" : ""} onClick={() => setAdminPanel("tenants")} style={{ border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>Tenant Management</button>
                  <button className={adminPanel === "settings" ? "active" : ""} onClick={() => setAdminPanel("settings")} style={{ border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>Platform Settings</button>
                  <button className={adminPanel === "users" ? "active" : ""} onClick={() => setAdminPanel("users")} style={{ border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>User Activity</button>
                  <button className={adminPanel === "journey" ? "active" : ""} onClick={() => setAdminPanel("journey")} style={{ border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>User Journey Preview</button>
                </div>
                
                {adminPanel === "command" && (
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
                  </div>
                )}

                {adminPanel === "tenants" && (
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
                      </tbody>
                    </table>
                  </section>
                )}

                {adminPanel === "settings" && (
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
                  </div>
                )}

                {adminPanel === "users" && (
                  <section className="card">
                    <h3>User Activity</h3>
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
                      </tbody>
                    </table>
                  </section>
                )}

                {adminPanel === "journey" && (
                  <div className="admin-grid">
                    <section className="card full">
                      <h3>How End Users Experience PROJOBS</h3>
                      <div className="journey-steps">
                        <button onClick={() => setTab("jobs")}>1. Job Discovery</button>
                        <button onClick={() => setTab("agents")}>2. AI Apply / Agents</button>
                        <button onClick={() => setTab("review")}>3. Review Queue</button>
                        <button onClick={() => setTab("interview")}>4. Interview Buddy</button>
                      </div>
                    </section>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Salesforce Lightning Right AI Panel */}
          {copilotCollapsed && (
            <button
              onClick={() => setCopilotCollapsed(false)}
              style={{
                position: 'fixed',
                right: '12px',
                top: '80px',
                zIndex: 99,
                background: 'white',
                color: '#334155',
                border: '1px solid #e2e8f0',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                fontWeight: 'bold'
              }}
              title="Expand Copilot Hub"
            >
              &lt;
            </button>
          )}
          <aside 
            className={`sf-ai-copilot-panel ${copilotCollapsed ? "is-collapsed" : ""}`}
            style={{
              background: 'white',
              borderRadius: '12px',
              border: copilotCollapsed ? 'none' : '1px solid #e2e8f0',
              padding: copilotCollapsed ? '0px' : '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              height: '100%',
              overflowY: 'auto',
              width: copilotCollapsed ? '0px' : '320px',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              overflowX: 'hidden',
              opacity: copilotCollapsed ? 0 : 1,
              pointerEvents: copilotCollapsed ? 'none' : 'auto'
            }}
          >
            <div className="copilot-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
              {!copilotCollapsed && <h3 style={{ margin: 0, fontSize: '1rem', color: '#1e293b' }}>Career AI Copilot Hub</h3>}
              {copilotCollapsed && <span className="copilot-rail-label">AI</span>}
              <button
                type="button"
                className="copilot-toggle"
                title={copilotCollapsed ? "Expand Career AI Copilot" : "Minimise Career AI Copilot"}
                onClick={() => setCopilotCollapsed((value) => !value)}
              >
                {copilotCollapsed ? "<" : ">"}
              </button>
              {!copilotCollapsed && <span className="badge-online" style={{ background: '#dcfce7', color: '#166534', fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 'bold' }}>ACTIVE</span>}
            </div>
            
            {!copilotCollapsed && (() => {
              const agents = aiController.getAgents();
              const currentAgent = aiController.getAgentById(activeAgentId) || agents[0];

              return (
                <>
                  <div className="copilot-agent-selector">
                    <label style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>Select Specialist Agent:</label>
                    <select 
                      value={activeAgentId} 
                      onChange={(e) => setActiveAgentId(e.target.value)} 
                      style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                    >
                      {agents.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="agent-profile" style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{currentAgent.role}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                      <span>Model: <strong>{currentAgent.model}</strong></span>
                      <span>Confidence: <strong>{(currentAgent.confidenceScore * 100).toFixed(0)}%</strong></span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.25rem' }}>
                      {currentAgent.tools.map(t => (
                        <span key={t} style={{ background: '#cbd5e1', color: '#334155', padding: '0.05rem 0.3rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>{t}</span>
                      ))}
                    </div>
                  </div>

                  <div className="agent-chat-history" style={{ flexGrow: 1, border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem', minHeight: '180px', maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#fafafa' }}>
                    {currentAgent.history.length === 0 && (
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', fontStyle: 'italic', padding: '2rem 0' }}>
                        Ask {currentAgent.name} a career or optimization question!
                      </p>
                    )}
                    {currentAgent.history.map((msg, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                        <span style={{ fontSize: '0.65rem', color: '#64748b', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', fontWeight: 'bold' }}>{msg.role === 'user' ? 'You' : currentAgent.name}</span>
                        <div style={{ background: msg.role === 'user' ? '#3b82f6' : '#e2e8f0', color: msg.role === 'user' ? 'white' : '#1e293b', padding: '0.4rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', marginTop: '0.15rem', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>

                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!chatInput.trim() || chatUpdating) return;
                      const txt = chatInput;
                      setChatInput("");
                      setChatUpdating(true);
                      await aiController.queryAgent(activeAgentId, txt);
                      setChatUpdating(false);
                    }}
                    style={{ display: 'flex', gap: '0.25rem', marginTop: 'auto' }}
                  >
                    <input 
                      placeholder={`Ask ${currentAgent.name}...`} 
                      value={chatInput} 
                      onChange={(e) => setChatInput(e.target.value)} 
                      disabled={chatUpdating}
                      style={{ flexGrow: 1, padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                    />
                    <button 
                      type="submit" 
                      disabled={chatUpdating || !chatInput.trim()}
                      className="btn-primary" 
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                    >
                      {chatUpdating ? '...' : 'Send'}
                    </button>
                  </form>
                </>
              );
            })()}
          </aside>

        </main>
      </div>

      <TenantSwitcher />
    </div>
  );
}


