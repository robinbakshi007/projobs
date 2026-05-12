import { useState } from "react";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";

type LoginPageProps = {
  onLogin: (token: string, tenantId: string, tenantSlug: string, email: string) => void;
};

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<"login" | "setup">("login");
  const [userType, setUserType] = useState<"customer" | "organisation" | "super_admin">("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const autofillSuperAdmin = () => {
    setUserType("super_admin");
    setEmail("super@admin.local");
    setPassword("superadmin123");
  };

  const autofillCustomer = () => {
    setUserType("customer");
    setEmail("customer@example.com");
    setPassword("password123");
  };

  const autofillOrganisation = () => {
    setUserType("organisation");
    setEmail("org@example.com");
    setPassword("password123");
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setStatus("Please enter email and password");
      return;
    }
    setLoading(true);
    setStatus("Signing in...");

    // If super_admin type selected, use super-admin-login endpoint
    if (userType === "super_admin") {
      await handleSuperAdminLogin();
      return;
    }

    const response = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const body = await response.json();
    if (!response.ok) {
      setStatus(body.message || `Login failed (${response.status})`);
      setLoading(false);
      return;
    }

    const token = body.token;
    const tenant = body.tenant;
    if (token) {
      onLogin(token, String(tenant?.id ?? ""), tenant?.slug ?? "", body.user?.email ?? email);
    } else {
      setStatus("Login succeeded but no token received");
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!email || !password || !name) {
      setStatus("Please fill in all fields");
      return;
    }
    setLoading(true);
    setStatus("Creating account...");

    const response = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        password_confirmation: password,
      }),
    });

    const body = await response.json();
    if (!response.ok) {
      setStatus(body.message || `Registration failed (${response.status})`);
      setLoading(false);
      return;
    }

    const token = body.token;
    const tenant = body.tenant;
    if (token) {
      onLogin(token, String(tenant?.id ?? ""), tenant?.slug ?? "", body.user?.email ?? email);
    } else {
      setStatus("Account created. Please log in.");
      setMode("login");
    }
    setLoading(false);
  };

  const handleSuperAdminLogin = async () => {
    setLoading(true);
    setStatus("Signing in as super admin...");

    const response = await fetch(`${API}/auth/super-admin-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password || undefined }),
    });

    const body = await response.json();
    if (!response.ok) {
      setStatus(body.message || `Super admin login failed (${response.status})`);
      setLoading(false);
      return;
    }

    const token = body.token;
    const tenant = body.tenant;
    if (token) {
      onLogin(token, String(tenant?.id ?? ""), tenant?.slug ?? "", body.user?.email ?? "super@admin.local");
    } else {
      setStatus("Super admin login succeeded but no token received");
    }
    setLoading(false);
  };

  return (
    <div className="login-shell">
      <div className="login-left">
        <div className="login-brand">
          <div className="login-logo">P</div>
          <h1>PRO<span>JOBS</span></h1>
          <p className="login-tagline">AI-powered job application platform</p>
        </div>

        <div className="login-card">
          <div className="login-tabs">
            <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
              LOGIN
            </button>
            <button className={mode === "setup" ? "active" : ""} onClick={() => setMode("setup")}>
              SETUP
            </button>
          </div>

          <div className="login-user-types">
            <button
              className={userType === "customer" ? "active" : ""}
              onClick={() => setUserType("customer")}
            >
              Customer
            </button>
            <button
              className={userType === "organisation" ? "active" : ""}
              onClick={() => setUserType("organisation")}
            >
              Organisation
            </button>
            <button
              className={userType === "super_admin" ? "active" : ""}
              onClick={() => setUserType("super_admin")}
            >
              Super Admin
            </button>
          </div>

          {mode === "login" ? (
            <>
              <div className="login-field">
                <label>USERNAME / EMAIL</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yourname@domain.com"
                />
              </div>
              <div className="login-field">
                <div className="login-label-row">
                  <label>PASSWORD</label>
                  <a href="#" className="login-link" onClick={(e) => { e.preventDefault(); setStatus("Password reset flow not implemented in UAT"); }}>
                    Forgot Password?
                  </a>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <button className="login-submit" onClick={handleLogin} disabled={loading}>
                {loading ? "Signing in..." : "Log In"}
              </button>
              <div className="login-autofill-row">
                <button className="login-autofill" onClick={autofillCustomer}>
                  Autofill Customer
                </button>
                <button className="login-autofill" onClick={autofillOrganisation}>
                  Autofill Organisation
                </button>
                <button className="login-autofill super" onClick={autofillSuperAdmin}>
                  Autofill Super Admin
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="login-field">
                <label>FULL NAME</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div className="login-field">
                <label>EMAIL</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yourname@domain.com"
                />
              </div>
              <div className="login-field">
                <label>PASSWORD</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <button className="login-submit" onClick={handleRegister} disabled={loading}>
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </>
          )}

          {status && <p className="login-status">{status}</p>}

          <a href="#" className="login-reset-link" onClick={(e) => { e.preventDefault(); setStatus("Setup / reset link flow not implemented in UAT"); }}>
            Send setup or reset link
          </a>
        </div>
      </div>

      <div className="login-right">
        <div className="login-welcome">
          <div className="login-welcome-icon">P</div>
          <h2>Welcome to your AI Job Portal</h2>
          <p>
            Discover roles, tailor your resume, practice interviews, and track applications — all in one intelligent workspace.
          </p>
        </div>

        <div className="login-features">
          <div className="login-feature">
            <div className="login-feature-icon">☑</div>
            <div>
              <strong>AI Resume Scanner</strong>
            </div>
          </div>
          <div className="login-feature">
            <div className="login-feature-icon">👤</div>
            <div>
              <strong>Interview Buddy</strong>
            </div>
          </div>
          <div className="login-feature active">
            <div className="login-feature-icon">⚡</div>
            <div>
              <strong>Smart Job Discovery</strong>
              <p>See active goals, provider updates, and support outcomes as they are shared.</p>
            </div>
          </div>
          <div className="login-feature">
            <div className="login-feature-icon">📄</div>
            <div>
              <strong>AI Apply & Agents</strong>
            </div>
          </div>
        </div>

        <div className="login-dots">
          <span />
          <span />
          <span />
          <span />
          <span className="active" />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
