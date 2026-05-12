import { useEffect, useMemo, useState } from "react";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";

interface Preference {
  id: number;
  role_title: string;
  location: string | null;
  work_type: string | null;
  skills: string[] | null;
  industries: string[] | null;
  min_salary: number | null;
  max_salary: number | null;
  currency: string;
  experience_level: string | null;
}

interface JobResult {
  id: number;
  title: string;
  company: string;
  location_text: string | null;
  description: string | null;
  salary_text: string | null;
  posted_at: string | null;
  match_score: number;
  preference_score_10?: number | string | null;
  score_breakdown_json?: Record<string, unknown> | null;
  status: string;
  apply_url: string | null;
}

type ExperienceLevel = "entry" | "mid" | "senior" | "lead";

type WorkArrangement = "remote" | "onsite" | "hybrid";

type RoleType = "full_time" | "part_time" | "contract" | "casual" | "internship";

interface ScoredJob extends JobResult {
  preferenceScore: number;
}

const PARSE_STEPS = [
  "Scanning CV structure",
  "Finding recipe for your profile",
  "Finding ingredients: skills and role clues",
  "Matching role types and career level",
  "Finalizing job search profile",
];

const SKILL_KEYWORDS = [
  "react",
  "typescript",
  "javascript",
  "python",
  "php",
  "laravel",
  "node",
  "sql",
  "postgres",
  "mysql",
  "aws",
  "azure",
  "docker",
  "kubernetes",
  "figma",
  "product",
  "sales",
  "marketing",
  "customer success",
  "project management",
  "communication",
  "leadership",
  "excel",
  "power bi",
  "data analysis",
  "machine learning",
];

const ROLE_HINTS: Array<{ key: string; title: string }> = [
  { key: "software engineer", title: "Software Engineer" },
  { key: "frontend", title: "Frontend Engineer" },
  { key: "backend", title: "Backend Engineer" },
  { key: "full stack", title: "Full Stack Engineer" },
  { key: "data scientist", title: "Data Scientist" },
  { key: "data analyst", title: "Data Analyst" },
  { key: "product manager", title: "Product Manager" },
  { key: "project manager", title: "Project Manager" },
  { key: "designer", title: "Product Designer" },
  { key: "devops", title: "DevOps Engineer" },
  { key: "qa", title: "QA Engineer" },
];

const ROLE_TYPE_OPTIONS: Array<{ label: string; value: RoleType }> = [
  { label: "Full Time", value: "full_time" },
  { label: "Part Time", value: "part_time" },
  { label: "Contract", value: "contract" },
  { label: "Casual", value: "casual" },
  { label: "Internship", value: "internship" },
];

const ROLE_TYPE_TOKENS: Record<RoleType, string[]> = {
  full_time: ["full time", "full-time", "permanent"],
  part_time: ["part time", "part-time"],
  contract: ["contract", "freelance", "contractor"],
  casual: ["casual", "temporary", "temp"],
  internship: ["intern", "internship", "graduate"],
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

function decodeRoleTypes(industries: string[] | null | undefined): RoleType[] {
  if (!industries || industries.length === 0) return [];
  return industries
    .filter((item) => item.startsWith("role_type:"))
    .map((item) => item.replace("role_type:", "") as RoleType)
    .filter((item) => ROLE_TYPE_OPTIONS.some((opt) => opt.value === item));
}

function encodeRoleTypes(roleTypes: RoleType[]): string[] {
  return roleTypes.map((type) => `role_type:${type}`);
}

function inferExperienceLevel(text: string): ExperienceLevel {
  const lower = text.toLowerCase();
  const yearsMatch = lower.match(/(\d+)\+?\s+years?/);
  const years = yearsMatch ? Number(yearsMatch[1]) : 0;

  if (years >= 8 || lower.includes("principal") || lower.includes("head of")) return "lead";
  if (years >= 5 || lower.includes("senior")) return "senior";
  if (years >= 2) return "mid";
  return "entry";
}

function inferRoleTitle(text: string): string {
  const lower = text.toLowerCase();
  const hinted = ROLE_HINTS.find((hint) => lower.includes(hint.key));
  if (hinted) return hinted.title;

  const titleLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /engineer|developer|manager|analyst|designer|consultant/i.test(line));

  if (titleLine) return titleLine.slice(0, 90);
  return "Software Engineer";
}

function inferSkills(text: string): string[] {
  const lower = text.toLowerCase();
  return SKILL_KEYWORDS.filter((skill) => lower.includes(skill)).slice(0, 12);
}

function inferRoleTypes(text: string): RoleType[] {
  const lower = text.toLowerCase();
  const found: RoleType[] = [];
  for (const option of ROLE_TYPE_OPTIONS) {
    const tokens = ROLE_TYPE_TOKENS[option.value];
    if (tokens.some((token) => lower.includes(token))) {
      found.push(option.value);
    }
  }
  return found;
}

async function extractPdfText(file: File): Promise<string> {
  const [pdfjs, pdfWorker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);

  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker.default;
  const raw = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(raw) });
  const doc = await loadingTask.promise;
  const maxPages = Math.min(doc.numPages, 6);

  const chunks: string[] = [];
  for (let pageNum = 1; pageNum <= maxPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => (typeof item.str === "string" ? item.str : ""))
      .join(" ");
    chunks.push(pageText);
  }

  return chunks.join("\n");
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

async function extractTxtText(file: File): Promise<string> {
  const text = await file.text();
  return text;
}

async function extractRtfText(file: File): Promise<string> {
  const text = await file.text();
  // Basic RTF cleanup - remove RTF control words
  return text
    .replace(/\\[a-z]+\d?\s?/g, " ")
    .replace(/[{}]/g, "")
    .replace(/\\'/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractCvText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return extractPdfText(file);
  if (name.endsWith(".docx")) return extractDocxText(file);
  if (name.endsWith(".txt")) return extractTxtText(file);
  if (name.endsWith(".rtf")) return extractRtfText(file);
  if (name.endsWith(".doc")) {
    throw new Error(
      ".doc format is not supported. Please convert to .docx or .pdf and try again."
    );
  }
  throw new Error("Supported formats: PDF, DOCX, TXT, RTF");
}

export default function JobDiscovery() {
  const [preference, setPreference] = useState<Preference | null>(null);
  const [results, setResults] = useState<JobResult[]>([]);
  const [roleTitle, setRoleTitle] = useState("");
  const [location, setLocation] = useState("");
  const [workType, setWorkType] = useState<WorkArrangement>("remote");
  const [skills, setSkills] = useState("");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("mid");
  const [roleTypes, setRoleTypes] = useState<RoleType[]>(["full_time"]);
  const [minSalary, setMinSalary] = useState("");
  const [maxSalary, setMaxSalary] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [parsePreview, setParsePreview] = useState("");
  const [isParsingCv, setIsParsingCv] = useState(false);
  const [parseStepIndex, setParseStepIndex] = useState(0);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMinScore, setFilterMinScore] = useState("0");
  const [filterLocation, setFilterLocation] = useState("");
  const [sortBy, setSortBy] = useState("score_desc");
  const [activeApplyJob, setActiveApplyJob] = useState<JobResult | null>(null);
  const [autoApplyStatus, setAutoApplyStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPreferences();
    loadResults();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await fetch(`${API}/job-discovery/preferences`, {
        headers: authHeaders(),
      });
      if (response.ok) {
        const body = await response.json();
        const prefs = body.data ?? [];
        if (prefs.length > 0) {
          const first = prefs[0] as Preference;
          setPreference(first);
          setRoleTitle(first.role_title ?? "");
          setLocation(first.location ?? "");
          setWorkType((first.work_type as WorkArrangement) ?? "remote");
          setSkills((first.skills ?? []).join(", "));
          setExperienceLevel((first.experience_level as ExperienceLevel) ?? "mid");
          setRoleTypes(decodeRoleTypes(first.industries));
          setMinSalary(first.min_salary ? String(first.min_salary) : "");
          setMaxSalary(first.max_salary ? String(first.max_salary) : "");
          setCurrency(first.currency ?? "USD");
        } else {
          const seen = localStorage.getItem("job_discovery_pref_seen") === "1";
          setOnboardingOpen(!seen);
        }
      }
    } catch {
      // ignore
    }
  };

  const loadResults = async () => {
    try {
      const response = await fetch(`${API}/job-discovery/results`, {
        headers: authHeaders(),
      });
      if (response.ok) {
        const body = await response.json();
        setResults(body.data ?? []);
      }
    } catch {
      // ignore
    }
  };

  const savePreference = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API}/job-discovery/preferences`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          role_title: roleTitle,
          location: location || null,
          work_type: workType,
          skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
          industries: encodeRoleTypes(roleTypes),
          min_salary: minSalary ? Number(minSalary) : null,
          max_salary: maxSalary ? Number(maxSalary) : null,
          currency,
          experience_level: experienceLevel,
        }),
      });
      if (!response.ok) throw new Error(`Save failed (${response.status})`);
      localStorage.setItem("job_discovery_pref_seen", "1");
      setOnboardingOpen(false);
      await loadPreferences();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const searchJobs = async () => {
    if (!preference) {
      setError("Save preferences first");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API}/job-discovery/search`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          preference_id: preference.id,
          query: `${roleTitle} jobs ${location} ${roleTypes.join(" ")} ${skills}`.trim(),
        }),
      });
      if (!response.ok) throw new Error(`Search failed (${response.status})`);
      await loadResults();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (resultId: number, status: string) => {
    try {
      await fetch(`${API}/job-discovery/results/${resultId}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      await loadResults();
    } catch {
      setError("Update failed");
    }
  };

  const toggleRoleType = (roleType: RoleType) => {
    setRoleTypes((current) => {
      if (current.includes(roleType)) {
        return current.filter((type) => type !== roleType);
      }
      return [...current, roleType];
    });
  };

  const parseCvAndAutofill = async () => {
    if (!cvFile) {
      setError("Please choose a CV file first");
      return;
    }

    setIsParsingCv(true);
    setError(null);
    setParseStepIndex(0);
    const timer = window.setInterval(() => {
      setParseStepIndex((prev) => (prev + 1 < PARSE_STEPS.length ? prev + 1 : prev));
    }, 1400);

    try {
      const text = await extractCvText(cvFile);
      const compact = text.replace(/\s+/g, " ").trim();
      const inferredRole = inferRoleTitle(compact);
      const inferredSkills = inferSkills(compact);
      const inferredExperience = inferExperienceLevel(compact);
      const inferredRoleTypes = inferRoleTypes(compact);

      setRoleTitle(inferredRole);
      setSkills(inferredSkills.join(", "));
      setExperienceLevel(inferredExperience);
      if (inferredRoleTypes.length > 0) {
        setRoleTypes(inferredRoleTypes);
      }

      setParsePreview(compact.slice(0, 320));
      setOnboardingOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse CV");
    } finally {
      window.clearInterval(timer);
      setParseStepIndex(PARSE_STEPS.length - 1);
      setIsParsingCv(false);
    }
  };

  const queueSeekAutoApply = async (job: JobResult) => {
    if (!job.apply_url) return;
    setAutoApplyStatus("");
    try {
      const response = await fetch(`${API}/agent-tasks`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          agent_id: "seek_applier",
          task_type: "apply_seek",
          payload_json: {
            job_url: job.apply_url,
            submit_enabled: false,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Could not queue seek apply (${response.status})`);
      }

      setAutoApplyStatus("Seek auto-apply queued in review mode. Open Agent Tasks to monitor.");
      await updateStatus(job.id, "viewed");
    } catch (err) {
      setAutoApplyStatus(err instanceof Error ? err.message : "Auto-apply queue failed");
    }
  };

  const scoredResults = useMemo<ScoredJob[]>(() => {
    return results.map((job) => ({
      ...job,
      preferenceScore: Number(job.preference_score_10 ?? 0),
    }));
  }, [results]);

  const filteredResults = useMemo<ScoredJob[]>(() => {
    const text = filterText.trim().toLowerCase();
    const locationQuery = filterLocation.trim().toLowerCase();
    const minScore = Number(filterMinScore);

    const filtered = scoredResults.filter((job) => {
      const haystack = `${job.title} ${job.company} ${job.description ?? ""}`.toLowerCase();
      const locationText = (job.location_text ?? "").toLowerCase();
      const textMatches = !text || haystack.includes(text);
      const statusMatches = filterStatus === "all" || job.status === filterStatus;
      const scoreMatches = Number.isNaN(minScore) ? true : job.preferenceScore >= minScore;
      const locationMatches = !locationQuery || locationText.includes(locationQuery);
      return textMatches && statusMatches && scoreMatches && locationMatches;
    });

    const sorted = [...filtered];
    if (sortBy === "score_desc") {
      sorted.sort((a, b) => b.preferenceScore - a.preferenceScore);
    } else if (sortBy === "score_asc") {
      sorted.sort((a, b) => a.preferenceScore - b.preferenceScore);
    } else if (sortBy === "latest") {
      sorted.sort((a, b) => (new Date(b.posted_at ?? 0).getTime() - new Date(a.posted_at ?? 0).getTime()));
    }
    return sorted;
  }, [filterText, filterStatus, filterMinScore, filterLocation, scoredResults, sortBy]);

  const activeParseMessage = PARSE_STEPS[parseStepIndex] ?? PARSE_STEPS[0];

  return (
    <div className="job-discovery">
      <h2>Job Discovery Studio</h2>
      <p className="subtitle">Upload CV, auto-build preferences, and discover scored jobs with smart filtering.</p>
      {error && <p className="error">{error}</p>}

      <section className="cv-parse-lab">
        <div className="cv-parse-head">
          <h3>1. Upload CV (PDF, DOCX, TXT, RTF)</h3>
          <p>We parse your CV to infer role, skills, and experience before job discovery. (.doc files should be converted to .docx)</p>
        </div>
        <div className="cv-parse-controls">
          <input
            type="file"
            accept=".pdf,.docx,.doc,.txt,.rtf"
            onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
          />
          <button onClick={parseCvAndAutofill} disabled={isParsingCv || !cvFile}>
            {isParsingCv ? "Parsing CV..." : "Parse CV and Autofill"}
          </button>
        </div>
        {isParsingCv && (
          <div className="parse-status" role="status" aria-live="polite">
            <div className="parse-spinner" />
            <div>
              <strong>{activeParseMessage}</strong>
              <p>Please wait while we extract profile ingredients from your CV.</p>
            </div>
          </div>
        )}
        {parsePreview && (
          <div className="parse-preview">
            <h4>Extracted summary preview</h4>
            <p>{parsePreview}</p>
          </div>
        )}
      </section>

      {onboardingOpen && (
        <section className="onboarding-panel">
          <h3>2. Confirm your preferences</h3>
          <p>Set your first-time preferences for location, salary expectations, and role type fit.</p>
          <div className="form-grid">
            <input
              placeholder="Preferred role title"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
            />
            <input
              placeholder="Preferred location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <select value={workType} onChange={(e) => setWorkType(e.target.value as WorkArrangement)}>
              <option value="remote">Remote</option>
              <option value="onsite">On-site</option>
              <option value="hybrid">Hybrid</option>
            </select>
            <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}>
              <option value="entry">Entry Level</option>
              <option value="mid">Mid Level</option>
              <option value="senior">Senior</option>
              <option value="lead">Lead</option>
            </select>
            <input
              placeholder="Expected salary min"
              value={minSalary}
              onChange={(e) => setMinSalary(e.target.value.replace(/[^0-9]/g, ""))}
            />
            <input
              placeholder="Expected salary max"
              value={maxSalary}
              onChange={(e) => setMaxSalary(e.target.value.replace(/[^0-9]/g, ""))}
            />
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="USD">USD</option>
              <option value="AUD">AUD</option>
              <option value="INR">INR</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
            <input
              placeholder="Skills (comma separated)"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="full"
            />
          </div>
          <div className="role-types">
            {ROLE_TYPE_OPTIONS.map((option) => (
              <label key={option.value} className="role-type-pill">
                <input
                  type="checkbox"
                  checked={roleTypes.includes(option.value)}
                  onChange={() => toggleRoleType(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <div className="form-actions">
            <button onClick={savePreference} disabled={busy || !roleTitle}>
              {busy ? "Saving..." : "Save Preferences"}
            </button>
            <button type="button" onClick={() => setOnboardingOpen(false)}>
              Close
            </button>
          </div>
        </section>
      )}

      <div className="preference-form">
        <h3>3. Search setup</h3>
        <div className="form-grid">
          <input
            placeholder="Role Title (e.g. Software Engineer)"
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
          />
          <input
            placeholder="Location (e.g. San Francisco)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <select value={workType} onChange={(e) => setWorkType(e.target.value as WorkArrangement)}>
            <option value="remote">Remote</option>
            <option value="onsite">On-site</option>
            <option value="hybrid">Hybrid</option>
          </select>
          <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}>
            <option value="entry">Entry Level</option>
            <option value="mid">Mid Level</option>
            <option value="senior">Senior</option>
            <option value="lead">Lead</option>
          </select>
          <input
            placeholder="Skills (comma separated)"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            className="full"
          />
        </div>
        <div className="role-types compact">
          {ROLE_TYPE_OPTIONS.map((option) => (
            <label key={option.value} className="role-type-pill">
              <input
                type="checkbox"
                checked={roleTypes.includes(option.value)}
                onChange={() => toggleRoleType(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        <div className="form-actions">
          <button onClick={savePreference} disabled={busy || !roleTitle}>
            {busy ? "Saving..." : "Save Preferences"}
          </button>
          <button onClick={searchJobs} disabled={busy || !preference}>
            {busy ? "Searching..." : "Search Jobs"}
          </button>
          <button type="button" onClick={() => setOnboardingOpen(true)}>Edit First-time Preferences</button>
        </div>
      </div>

      <div className="results-list">
        <h3>4. Discovered jobs ({filteredResults.length})</h3>
        <div className="results-filters">
          <input
            placeholder="Filter by title, company, keywords"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          <input
            placeholder="Filter by location"
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="viewed">Viewed</option>
            <option value="saved">Saved</option>
            <option value="applied">Applied</option>
          </select>
          <select value={filterMinScore} onChange={(e) => setFilterMinScore(e.target.value)}>
            <option value="0">Min score 0/10</option>
            <option value="4">Min score 4/10</option>
            <option value="6">Min score 6/10</option>
            <option value="7">Min score 7/10</option>
            <option value="8">Min score 8/10</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="score_desc">Sort: Best score first</option>
            <option value="score_asc">Sort: Lowest score first</option>
            <option value="latest">Sort: Latest posted first</option>
          </select>
        </div>

        {filteredResults.length === 0 && <p className="small-muted">No jobs discovered yet. Save preferences and search.</p>}

        {filteredResults.length > 0 && (
          <div className="jobs-table-wrap">
            <table className="jobs-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Company</th>
                  <th>Location</th>
                  <th>Salary</th>
                  <th>Score / 10</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <strong>{job.title}</strong>
                      {job.description && <p className="job-row-desc">{job.description.slice(0, 120)}...</p>}
                    </td>
                    <td>{job.company}</td>
                    <td>{job.location_text ?? "-"}</td>
                    <td>{job.salary_text ?? "-"}</td>
                    <td>
                      <span className="score-chip">{job.preferenceScore.toFixed(1)}</span>
                    </td>
                    <td>
                      <select value={job.status} onChange={(e) => updateStatus(job.id, e.target.value)}>
                        <option value="new">New</option>
                        <option value="viewed">Viewed</option>
                        <option value="saved">Saved</option>
                        <option value="applied">Applied</option>
                      </select>
                    </td>
                    <td>
                      <div className="job-actions compact">
                        <button
                          type="button"
                          onClick={() => setActiveApplyJob(job)}
                          disabled={!job.apply_url}
                        >
                          Apply
                        </button>
                        {job.apply_url && (
                          <a href={job.apply_url} target="_blank" rel="noreferrer" className="apply-link">
                            Open
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activeApplyJob && (
        <div className="apply-lab">
          <div className="apply-lab-header">
            <div>
              <h3>Apply Lab: {activeApplyJob.title}</h3>
              <p>
                Embedded apply can fail on some sites due to iframe security headers.
                Use Open if the embed does not load.
              </p>
            </div>
            <button type="button" onClick={() => setActiveApplyJob(null)}>Close</button>
          </div>

          <div className="apply-lab-actions">
            {activeApplyJob.apply_url && (
              <>
                <a href={activeApplyJob.apply_url} target="_blank" rel="noreferrer" className="apply-link">
                  Open in new tab
                </a>
                <button
                  type="button"
                  onClick={() => queueSeekAutoApply(activeApplyJob)}
                  disabled={!activeApplyJob.apply_url.includes("seek")}
                >
                  Queue Seek Auto-Apply (Review Mode)
                </button>
              </>
            )}
          </div>

          {autoApplyStatus && <p className="small-muted">{autoApplyStatus}</p>}

          {activeApplyJob.apply_url ? (
            <iframe
              title="apply-lab"
              src={activeApplyJob.apply_url}
              className="apply-frame"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer"
            />
          ) : (
            <p className="small-muted">No apply URL available for this job.</p>
          )}
        </div>
      )}
    </div>
  );
}
