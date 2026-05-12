import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";

interface Scan {
  id: number;
  original_path: string;
  rebuilt_path: string | null;
  layout_preserved: boolean;
  layout_hash: string | null;
  ats_score_before: number | null;
  ats_score_after: number | null;
  status: string;
  created_at: string;
}

interface DiffData {
  layout_preserved: boolean;
  layout_hash: string;
  ats_score_before: number;
  ats_score_after: number;
  match_score: number;
  diff: {
    sections_changed: string[];
    layout_locked: boolean;
    style_preserved: boolean;
  };
  analysis: {
    injected_keywords: string[];
    missing_keywords: string[];
    suggestions: string[];
  };
  ats_systems_checked: Array<{
    name: string;
    compatible: boolean;
    score: number;
  }>;
  formatting_issues: Array<{
    issue: string;
    severity: string;
    fix: string;
  }>;
  content_suggestions: Array<{
    section: string;
    suggestion: string;
  }>;
  grammar_issues: Array<{
    type: string;
    count: number;
    example: string;
  }>;
  keyword_recommendations: Array<{
    keyword: string;
    priority: string;
    context: string;
  }>;
  rewrite_suggestions: Array<{
    original: string;
    rewritten: string;
  }>;
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

export default function ResumeScanner() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [path, setPath] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  const [diff, setDiff] = useState<DiffData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");

  useEffect(() => {
    loadScans();
  }, []);

  const loadScans = async () => {
    try {
      const response = await fetch(`${API}/resume-scans`, {
        headers: authHeaders(),
      });
      if (response.ok) {
        const body = await response.json();
        setScans(body.data ?? []);
      }
    } catch {
      setError("Failed to load scans");
    }
  };

  const handleFileUpload = async () => {
    if (!cvFile) return;
    setBusy(true);
    setError(null);
    setUploadStatus("Uploading...");
    try {
      const formData = new FormData();
      formData.append("cv", cvFile);
      formData.append("job_description", jobDesc);

      const response = await fetch(`${API}/resume-scans/upload`, {
        method: "POST",
        headers: {
          ...(authHeaders() as Record<string, string>),
          // Let browser set Content-Type for multipart
        },
        body: formData,
      });
      if (!response.ok) throw new Error(`Upload failed (${response.status})`);
      const body = await response.json();
      setScans((prev) => [body.data, ...prev]);
      setCvFile(null);
      setJobDesc("");
      setUploadStatus("Upload successful!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploadStatus("");
    } finally {
      setBusy(false);
    }
  };

  const runScan = async () => {
    if (!path) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API}/resume-scans`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ original_path: path, job_description: jobDesc }),
      });
      if (!response.ok) throw new Error(`Scan failed (${response.status})`);
      const body = await response.json();
      setScans((prev) => [body.data, ...prev]);
      setPath("");
      setJobDesc("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  };

  const viewDiff = async (scan: Scan) => {
    setSelectedScan(scan);
    setDiff(null);
    try {
      const response = await fetch(`${API}/resume-scans/${scan.id}/diff`, {
        headers: authHeaders(),
      });
      if (response.ok) {
        const body = await response.json();
        setDiff(body.data);
      }
    } catch {
      setError("Failed to load diff");
    }
  };

  return (
    <div className="resume-scanner">
      <h2>AI Resume Scanner (Layout Preserve)</h2>
      {error && <p className="error">{error}</p>}

      <div className="scan-form">
        <div className="upload-section">
          <label className="upload-label">Upload CV (PDF, DOCX, TXT, RTF)</label>
          <input
            type="file"
            accept=".pdf,.docx,.doc,.txt,.rtf"
            onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
          />
          {cvFile && <span className="file-name">{cvFile.name}</span>}
          <button onClick={handleFileUpload} disabled={busy || !cvFile}>
            {busy ? "Uploading..." : "Upload & Scan"}
          </button>
          {uploadStatus && <span className="upload-status">{uploadStatus}</span>}
        </div>

        <div className="divider">— or enter path manually —</div>

        <input
          placeholder="Original resume path (e.g. /uploads/resume.pdf)"
          value={path}
          onChange={(e) => setPath(e.target.value)}
        />
        <textarea
          rows={3}
          placeholder="Job description (optional)"
          value={jobDesc}
          onChange={(e) => setJobDesc(e.target.value)}
        />
        <button onClick={runScan} disabled={busy || !path}>
          {busy ? "Scanning..." : "Scan & Rebuild"}
        </button>
      </div>

      <div className="scans-list">
        <h3>Scans</h3>
        {scans.length === 0 && <p>No scans yet.</p>}
        {scans.map((scan) => (
          <div key={scan.id} className="scan-row">
            <span>{scan.original_path}</span>
            <span className={`status ${scan.status}`}>{scan.status}</span>
            <span>
              ATS: {scan.ats_score_before ?? "—"} →{" "}
              {scan.ats_score_after ?? "—"}
            </span>
            <button onClick={() => viewDiff(scan)}>View Diff</button>
          </div>
        ))}
      </div>

      {selectedScan && diff && (
        <div className="diff-panel">
          <h3>Diff: {selectedScan.original_path}</h3>

          <div className="diff-stats">
            <div className="stat-box">
              <span>Layout Preserved</span>
              <strong>{diff.layout_preserved ? "Yes" : "No"}</strong>
            </div>
            <div className="stat-box">
              <span>Match Score</span>
              <strong>{diff.match_score}%</strong>
            </div>
            <div className="stat-box">
              <span>ATS Before</span>
              <strong>{diff.ats_score_before}</strong>
            </div>
            <div className="stat-box">
              <span>ATS After</span>
              <strong>{diff.ats_score_after}</strong>
            </div>
          </div>

          <div className="diff-sections">
            <h4>Sections Changed</h4>
            <div className="chips">
              {diff.diff.sections_changed.map((s) => (
                <span key={s} className="chip">
                  {s}
                </span>
              ))}
            </div>
            <p>Layout locked: {diff.diff.layout_locked ? "Yes" : "No"}</p>
            <p>Style preserved: {diff.diff.style_preserved ? "Yes" : "No"}</p>
          </div>

          <div className="analysis">
            <h4>ATS Systems Checked</h4>
            <div className="ats-systems">
              {diff.ats_systems_checked.map((system) => (
                <div key={system.name} className="system-row">
                  <span className="system-name">{system.name}</span>
                  <span className={`system-status ${system.compatible ? "compatible" : "incompatible"}`}>
                    {system.compatible ? "✓ Compatible" : "✗ Issues"}
                  </span>
                  <span className="system-score">{system.score}/100</span>
                </div>
              ))}
            </div>
          </div>

          <div className="analysis">
            <h4>Keyword Recommendations</h4>
            <div className="keyword-recs">
              {diff.keyword_recommendations.map((rec) => (
                <div key={rec.keyword} className="rec-row">
                  <span className={`priority ${rec.priority}`}>{rec.priority}</span>
                  <span className="keyword">{rec.keyword}</span>
                  <span className="context">{rec.context}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="analysis">
            <h4>Formatting Issues</h4>
            <div className="issues-list">
              {diff.formatting_issues.map((issue, i) => (
                <div key={i} className={`issue-row ${issue.severity}`}>
                  <span className="issue-name">{issue.issue}</span>
                  <span className="issue-fix">Fix: {issue.fix}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="analysis">
            <h4>Content Suggestions</h4>
            <div className="content-suggestions">
              {diff.content_suggestions.map((suggestion, i) => (
                <div key={i} className="suggestion-row">
                  <span className="section">{suggestion.section}</span>
                  <span className="suggestion-text">{suggestion.suggestion}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="analysis">
            <h4>Grammar Issues</h4>
            <div className="grammar-issues">
              {diff.grammar_issues.map((issue, i) => (
                <div key={i} className="grammar-row">
                  <span className="grammar-type">{issue.type.replace("_", " ")}</span>
                  <span className="grammar-count">{issue.count} found</span>
                  <span className="grammar-example">"{issue.example}"</span>
                </div>
              ))}
            </div>
          </div>

          <div className="analysis">
            <h4>AI Rewrite Suggestions</h4>
            <div className="rewrite-suggestions">
              {diff.rewrite_suggestions.map((rewrite, i) => (
                <div key={i} className="rewrite-row">
                  <div className="original">
                    <span className="label">Original:</span>
                    <p>{rewrite.original}</p>
                  </div>
                  <div className="rewritten">
                    <span className="label">Rewritten:</span>
                    <p>{rewrite.rewritten}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="analysis">
            <h4>ATS Analysis</h4>
            <div className="kw-section">
              <h5>Injected Keywords</h5>
              <div className="chips">
                {diff.analysis.injected_keywords.map((kw) => (
                  <span key={kw} className="chip injected">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
            <div className="kw-section">
              <h5>Missing Keywords</h5>
              <div className="chips">
                {diff.analysis.missing_keywords.map((kw) => (
                  <span key={kw} className="chip missing">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
            <div className="suggestions">
              <h5>Suggestions</h5>
              <ul>
                {diff.analysis.suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
