import { useEffect, useState } from "react";

export interface ReviewJob {
  id: number;
  title: string;
  company: string;
  location_text: string;
  source_url: string;
  description_text: string;
  posted_at: string | null;
}

export interface TailoringResult {
  ats_score_before: number;
  ats_score_after: number;
  summary_before: string;
  summary_after: string;
  injected_keywords: string[];
  missing_keywords: string[];
  cv_path: string;
  cl_path: string;
}

export interface ReviewItem {
  application_id: number;
  job: ReviewJob;
  tailoring: TailoringResult;
  status: "pending" | "pending_review" | "approved" | "skipped" | "editing";
}

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("auth_token") ?? "";
  const tenantId = localStorage.getItem("tenant_id") ?? "";

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
  };
}

async function fetchReviewQueue(): Promise<ReviewItem[]> {
  const response = await fetch(`${API}/review-queue`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to load queue (${response.status})`);
  }

  const body = await response.json();
  return body.data ?? [];
}

async function approveApplication(applicationId: number): Promise<void> {
  const response = await fetch(`${API}/applications/${applicationId}/approve`, {
    method: "POST",
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Approve failed (${response.status})`);
  }
}

async function skipApplication(applicationId: number): Promise<void> {
  const response = await fetch(`${API}/applications/${applicationId}/skip`, {
    method: "POST",
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Skip failed (${response.status})`);
  }
}

function JobContextPanel({ job }: { job: ReviewJob }) {
  const sourceHost = job.source_url ? new URL(job.source_url).hostname : "Job Board";

  return (
    <div className="panel panel-left">
      <div className="panel-header">
        <span className="badge badge-source">{sourceHost}</span>
        <h2 className="job-title">{job.title}</h2>
        <p className="job-meta">
          {job.company} · {job.location_text}
          {job.posted_at && ` · Posted ${new Date(job.posted_at).toLocaleDateString()}`}
        </p>
        <a href={job.source_url} target="_blank" rel="noreferrer" className="btn-link">
          View original ↗
        </a>
      </div>
      <div className="panel-body jd-scroll">
        <pre className="jd-text">{job.description_text}</pre>
      </div>
    </div>
  );
}

function DocumentPreviewPanel({ tailoring }: { tailoring: TailoringResult }) {
  const [tab, setTab] = useState<"summary" | "full">("summary");
  const previewUrl = tailoring.cv_path || tailoring.cl_path;

  return (
    <div className="panel panel-center">
      <div className="panel-header">
        <h3>Document Preview</h3>
        <div className="tabs">
          <button className={`tab ${tab === "summary" ? "active" : ""}`} onClick={() => setTab("summary")}>
            Summary diff
          </button>
          <button className={`tab ${tab === "full" ? "active" : ""}`} onClick={() => setTab("full")}>
            Full CV path
          </button>
        </div>
      </div>

      <div className="panel-body">
        {tab === "summary" ? (
          <div className="diff-view">
            <div className="diff-block diff-before">
              <span className="diff-label">Before</span>
              <p>{tailoring.summary_before}</p>
            </div>
            <div className="diff-arrow">↓ AI rewrite</div>
            <div className="diff-block diff-after">
              <span className="diff-label">After</span>
              <p>{tailoring.summary_after}</p>
            </div>
          </div>
        ) : (
          <div className="file-paths">
            <p><strong>CV:</strong> {tailoring.cv_path}</p>
            <p><strong>Cover Letter:</strong> {tailoring.cl_path}</p>
            {previewUrl ? (
              <iframe
                title="document-preview"
                src={previewUrl}
                style={{ width: "100%", height: "260px", border: "1px solid #374151", borderRadius: "6px" }}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function AtsAnalysisPanel({ tailoring }: { tailoring: TailoringResult }) {
  const improvement = tailoring.ats_score_after - tailoring.ats_score_before;

  return (
    <div className="panel panel-right">
      <div className="panel-header">
        <h3>ATS Analysis</h3>
      </div>
      <div className="panel-body">
        <div className="score-block">
          <div className="score-row">
            <span className="score-label">Before</span>
            <div className="score-bar-wrap">
              <div className="score-bar score-bar-before" style={{ width: `${tailoring.ats_score_before}%` }} />
            </div>
            <span className="score-pct">{tailoring.ats_score_before.toFixed(0)}%</span>
          </div>

          <div className="score-row">
            <span className="score-label">After</span>
            <div className="score-bar-wrap">
              <div className="score-bar score-bar-after" style={{ width: `${tailoring.ats_score_after}%` }} />
            </div>
            <span className="score-pct">{tailoring.ats_score_after.toFixed(0)}%</span>
          </div>

          <p className={`score-delta ${improvement >= 0 ? "positive" : "negative"}`}>
            {improvement >= 0 ? "+" : ""}
            {improvement.toFixed(0)}% improvement
          </p>
        </div>

        <div className="kw-section">
          <h4>Injected keywords</h4>
          <div className="kw-chips">
            {tailoring.injected_keywords.map((kw) => (
              <span key={kw} className="chip chip-injected">
                {kw}
              </span>
            ))}
          </div>
        </div>

        {tailoring.missing_keywords.length > 0 && (
          <div className="kw-section">
            <h4>Still missing</h4>
            <div className="kw-chips">
              {tailoring.missing_keywords.map((kw) => (
                <span key={kw} className="chip chip-missing">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBar({
  item,
  onApprove,
  onEdit,
  onSkip,
  busy,
}: {
  item: ReviewItem;
  onApprove: () => void;
  onEdit: () => void;
  onSkip: () => void;
  busy: boolean;
}) {
  return (
    <div className="action-bar">
      <div className="action-meta">
        Application #{item.application_id} · {item.job.title} @ {item.job.company}
      </div>
      <div className="action-buttons">
        <button className="btn btn-skip" onClick={onSkip} disabled={busy}>
          Skip
        </button>
        <button className="btn btn-edit" onClick={onEdit} disabled={busy}>
          Edit Manually
        </button>
        <button className="btn btn-approve" onClick={onApprove} disabled={busy}>
          {busy ? "Sending..." : "Approve & Apply ✓"}
        </button>
      </div>
    </div>
  );
}

export default function ReviewMode() {
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const loadQueue = async () => {
      try {
        const items = await fetchReviewQueue();
        if (! disposed) {
          setQueue(items);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (! disposed) {
          setError(message);
        }
      } finally {
        if (! disposed) {
          setLoading(false);
        }
      }

    };

    loadQueue();
    const interval = setInterval(loadQueue, 15000);

    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, []);

  const current = queue[currentIndex];

  const advance = () => {
    if (currentIndex < queue.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setQueue([]);
    }
  };

  const handleApprove = async () => {
    if (!current) return;
    setBusy(true);
    setError(null);

    try {
      await approveApplication(current.application_id);
      setQueue((q) => q.map((item, i) => (i === currentIndex ? { ...item, status: "approved" } : item)));
      advance();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Approve request failed";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = async () => {
    if (!current) return;
    setBusy(true);
    setError(null);

    try {
      await skipApplication(current.application_id);
      setQueue((q) => q.map((item, i) => (i === currentIndex ? { ...item, status: "skipped" } : item)));
      advance();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Skip request failed";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = () => {
    if (!current) return;
    setQueue((q) => q.map((item, i) => (i === currentIndex ? { ...item, status: "editing" } : item)));
  };

  if (loading) return <div className="review-loading">Loading review queue...</div>;
  if (error) return <div className="review-error">{error}</div>;
  if (!current) return <div className="review-empty">All applications reviewed.</div>;

  return (
    <div className="review-mode">
      <div className="queue-progress">
        <span className="queue-label">
          Review {currentIndex + 1} / {Math.max(queue.length, 1)}
        </span>
        <div className="queue-bar-wrap">
          <div
            className="queue-bar"
            style={{ width: `${((currentIndex + 1) / Math.max(queue.length, 1)) * 100}%` }}
          />
        </div>
      </div>

      <div className="review-panels">
        <JobContextPanel job={current.job} />
        <DocumentPreviewPanel tailoring={current.tailoring} />
        <AtsAnalysisPanel tailoring={current.tailoring} />
      </div>

      <ActionBar item={current} onApprove={handleApprove} onEdit={handleEdit} onSkip={handleSkip} busy={busy} />
    </div>
  );
}
