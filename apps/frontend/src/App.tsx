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
  ["Email signup/login", "Real auth with local fallbacks, registration/login", "85%", "Fix: forgotPassword/sendVerification token leak in JSON responses."],
  ["Email 2FA codes", "MFA/SMS code routing and provider integration", "70%", "WireTwilio/Sinch with audit logs before production launch."],
  ["Google/Microsoft SSO", "SSO entry points and callback-ready UI stubs", "15%", "Register OAuth client IDs and validate callback routes in production."],
  ["CV upload/parser", "PDF/DOCX/TXT/RTF parser with auto-populate & preview", "85%", "Enhance data extraction precision across diverse formatting layouts."],
  ["CV style swapping", "Modern, Classic, Creative selectors with design preferences", "90%", "Persist selected template configuration to the PDF exporter engine."],
  ["AI CV tailoring", "Worker OpenAI tailoring & python-docx engine", "30%", "Wire worker-to-backend-to-UI delivery for generated docx files."],
  ["AI cover letter", "AI-based cover-letter editor and tailoring", "30%", "Add company fact-grounding and resolve spacing collapsing bugs."],
  ["Job discovery", "Preferences schema, filters, and dynamic workspace tabs", "80%", "Integrate real SEEK/LinkedIn scrapers with throttling controls."],
  ["Credential/session setup", "Consent-first session vault handoff system", "55%", "Add encryption/rotation checks and test against real Seek 2FA."],
  ["Browser apply agent", "Playwright worker with persistent context local profile", "50%", "Fix screenshot temp path on Windows and refine DOM selector logic."],
  ["Hermes-style scheduler", "Worker task gateway and queue endpoints", "25%", "Transition from in-memory TASK_STORE dictionary to Redis/DB queue."],
  ["Review queue", "Review gate, task state, and approve/skip routing", "75%", "Set review queue as the mandatory default before final apply submit."],
  ["ATS scan", "Est. alignment score & Missing keywords highlighter", "10%", "Wire the mock analyze controller to a real parser/LLM service."],
  ["Analytics", "Pipeline, funnel, and metrics backend database queries", "35%", "Connect the frontend panel widgets to the live backend analytics API."],
  ["Product Activation", "Milestones tracker and pre-filled defaults", "50%", "Integrate frontend tracker with live backend quotas / analytics."],
  ["Trust & Security", "MFA readiness, policy check controllers", "70%", "Secure auth token leaks and configure production SMS APIs."],
  ["Review Intelligence", " Edits explanation & confidence metrics", "60%", "Heuristic-based checks; add model-backed scoring comparisons."],
  ["Automation Resilience", "Checkpoints, OTP pause/resume sync", "55%", "Verify persistent session profiles across multiple devices."],
  ["Outcome Analytics", "Cohort tracking, conversion rates", "30%", "Backfill user conversion tables once production data accumulates."],
  ["Enterprise Controls", "Role based access, compliance exports", "20%", "Map tenant policy packs and implement compliance PDF generator."],
  ["Operational Excellence", "Ops dashboard, recovery runbooks", "15%", "Wire automated failure alert routing to developers."],
];

const journeys = [
  ["PDF View Overlay (from CVGENIUS)", "Streams PDFs inline with zoom controls", "85%", "Verify exact CSS rendering parity across browser engines."],
  ["Document Generation Wizard (from CVGENIUS)", "Guided 5-step application wizard", "75%", "Support dynamic custom steps injection based on job type."],
  ["Job Discovery Studio", "Tabbed job dashboard and candidate details", "80%", "Back with real grounding job search results instead of mocks."],
  ["ATS Match Studio", "Missing keyword highlights and formatting analyzer", "15%", "Connect to actual AI resume parser analysis output."],
  ["Recruiter CRM", "Recruiter contact board and interaction tracking", "15%", "Convert static demo constructor data to live API calls."],
  ["CV & Cover Letter Tailoring", "On-the-fly text editing and tailoring", "30%", "Wire the worker tailoring result files to display in preview."],
  ["Seek Auto-Apply Agent", "Controlled persistent profile browser launcher", "50%", "Open headful SEEK browser to save login cookies in local vault."],
  ["LinkedIn Auto-Apply Agent", "Forms filler and extension companion stubs", "10%", "Implement the chrome extension EasyApply script handler."],
  ["Interview Buddy", "Mock interview setup and practice session", "40%", "Replace hardcoded keyword checks with an LLM feedback endpoint."],
  ["Tenant Workspace Switcher", "Footer switcher workspace settings sync", "85%", "Add permission enforcement checks when shifting contexts."],
  ["Billing & Subscription panel", "Stripe payment gateway checkout flows", "80%", "Add mock alerts when Stripe credentials are not configured."]
];

const featureReadinessRows = [
  ...journeys,
  ...platformBuildoutRows,
];

const reactiveResumeLearningRows = [
  ["CV template switching", "Modern, Classic, Creative templates with designer dashboard", "90%", "Add more industry-specific design templates to library."],
  ["Thumbnail-accurate layouts", "Layout matching preview closely", "85%", "Finish exact visual parity for every design preset and export mode."],
  ["Font switching", "Heading/body font, size, line spacing presets", "100%", "Typographical settings complete; saved style presets work."],
  ["Text color control", "Custom text color colorpicker", "100%", "Contrast guidance warnings are live for dark/light themes."],
  ["Accent color control", "Headings, dividers, chips, and bullets colors", "100%", "Live color pickers fully operational across all layouts."],
  ["Background color control", "Paper, container, and sidebar background customization", "100%", "Live preview syncs perfectly without performance lag."],
  ["Profile photo upload", "Upload, persistent gallery, select/remove options", "100%", "Upgrade to cloud media storage once backend is deployed."],
  ["Photo editing", "Brightness, contrast, crop, zoom, photo roundness", "95%", "Integrate smart face centering model for portrait helper."],
  ["Icons in CV", "Contact icons and metadata graphics", "90%", "Include a wider choice of external SVG icon packs."],
  ["Structured resume data", "Parsed CV mapping and edit fields sync", "90%", "Transition fully to schema-backed nested JSON blocks."],
  ["Section management", "Show/hide, rename, add custom sections, drag to sort", "100%", "Section state saving works and updates preview dynamically."],
  ["Layout controls", "Density, margins, line spacing, sidebar width controls", "100%", "Spacing updates apply instantly in live preview window."],
  ["Color themes / presets", "Design templates color packs and custom presets", "100%", "User can save and reload custom design packages."],
  ["Export fidelity", "Vite print-to-PDF print styles, backend DOC export", "60%", "Vite print works; backend DOC uses HTML fallback, need OOXML."],
  ["Reusable design tokens", "Colors, fonts, spacing, margins fully tokenized", "92%", "Move the remaining hardcoded values into the style token maps."],
  ["Resume gallery / variants", "Multiple CV variants creation, loading, deleting", "100%", "Live variants sync and switching is fully supported."],
  ["Share / publish", "Recruiter public links and view tracker counter", "90%", "Add private links passwords and analytics dashboard."],
  ["AI design assistant", "Design guidelines checks and density alert helper", "80%", "Wire to AI feedback helper for custom template selection."],
  ["ATS-safe design warnings", "Photos use, creative template warnings, margins scanner", "100%", "Alerts pop up dynamically during template selection."],
  ["Template customization UX", "Designer layout builder sidebar", "100%", "Sidebar navigation is fully integrated and functional."],
  ["Icon library integration", "Contact and section SVG inline graphics", "80%", "Include Lucide or FontAwesome icon packages."],
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
                  <h3>Reactive Resume Learnings</h3>
                  <p className="subtitle" style={{ marginBottom: '1rem' }}>
                    Reference: <a href="https://github.com/amruthpillai/reactive-resume" target="_blank" rel="noreferrer">amruthpillai/reactive-resume</a>
                  </p>
                  <table>
                    <thead>
                      <tr>
                        <th>Feature / Function</th>
                        <th>What CareerOS Has</th>
                        <th>Readiness</th>
                        <th>Suggestion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reactiveResumeLearningRows.map((row) => (
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


