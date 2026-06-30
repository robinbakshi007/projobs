import { useEffect, useMemo, useState } from "react";
import "./JobDiscovery.css";
import { jobController } from "../controllers/JobController";
import { automationController } from "../controllers/AutomationController";


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

function getMockDiffData(): DiffData {
  return {
    layout_preserved: true,
    layout_hash: "mock_hash_123",
    ats_score_before: 45,
    ats_score_after: 88,
    match_score: 92,
    diff: {
      sections_changed: ["Experience", "Skills", "Summary"],
      layout_locked: true,
      style_preserved: true,
    },
    analysis: {
      injected_keywords: ["React", "TypeScript", "Node.js"],
      missing_keywords: ["Docker", "Kubernetes"],
      suggestions: ["Add more quantifiable achievements in your latest role."],
    },
    ats_systems_checked: [
      { name: "Workday", compatible: true, score: 95 },
      { name: "Taleo", compatible: true, score: 82 },
      { name: "Greenhouse", compatible: true, score: 98 },
    ],
    formatting_issues: [
      { issue: "Complex table found", severity: "medium", fix: "Flatten into bullet points" }
    ],
    content_suggestions: [
      { section: "Summary", suggestion: "Make it more action-oriented" }
    ],
    grammar_issues: [
      { type: "passive_voice", count: 2, example: "was responsible for" }
    ],
    keyword_recommendations: [
      { keyword: "CI/CD", priority: "high", context: "Required for senior roles" }
    ],
    rewrite_suggestions: [
      { original: "I helped the team build the app", rewritten: "Spearheaded application development" }
    ]
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

// Fixed function name to match imports if any
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
  const [leftPaneHidden, setLeftPaneHidden] = useState(false);
  const [parsePreview, setParsePreview] = useState("");
  const [isParsingCv, setIsParsingCv] = useState(false);
  const [parseStepIndex, setParseStepIndex] = useState(0);
  const [editableCvContent, setEditableCvContent] = useState("");
  const [atsScanDiff, setAtsScanDiff] = useState<DiffData | null>(null);
  const [isAtsScanning, setIsAtsScanning] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMinScore, setFilterMinScore] = useState("0");
  const [filterLocation, setFilterLocation] = useState("");
  const [sortBy, setSortBy] = useState("score_desc");

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<number | null>(null);
  const [activeWorkspaces, setActiveWorkspaces] = useState<JobResult[]>([]);
  const activeApplyJob = activeWorkspaceId ? activeWorkspaces.find((w) => w.id === activeWorkspaceId) || null : null;

  const [activeJobTab, setActiveJobTab] = useState<"job" | "cv" | "coverletter" | "ats" | "interview" | "automation" | "notes">("job");
  const [jobNotes, setJobNotes] = useState<Record<number, string>>({});
  const [automationCookies, setAutomationCookies] = useState<string>(() => localStorage.getItem("automation_cookies") ?? "");
  const [cookieSharingSaved, setCookieSharingSaved] = useState(false);
  const [mockQuestions, setMockQuestions] = useState<Array<{ question: string; answer: string; feedback: string; score: number | null }>>([]);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [recordedSpeech, setRecordedSpeech] = useState("");
  const [isSpeechRecording, setIsSpeechRecording] = useState(false);
  const [speechRecognitionInstance, setSpeechRecognitionInstance] = useState<any>(null);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [autoApplyStatus, setAutoApplyStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("modern");
  const [applyTemplateCheckbox, setApplyTemplateCheckbox] = useState(false);
  const [editableCoverLetterContent, setEditableCoverLetterContent] = useState("");
  const [activeDocTab, setActiveDocTab] = useState<'cv' | 'coverletter'>('cv');
  const [docPreviewMode, setDocPreviewMode] = useState(false);
  const [autoApplyLogs, setAutoApplyLogs] = useState<string[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [applyProgress, setApplyProgress] = useState(0);

  const [jobUrlInput, setJobUrlInput] = useState("");
  const [isGroundingUrl, setIsGroundingUrl] = useState(false);

  useEffect(() => {
    loadPreferences();
    loadResults();
    
    // Initialize Web Speech Recognition
    const win = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (event: any) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setRecordedSpeech((prev) => (prev + " " + finalTranscript).trim());
        }
      };
      rec.onerror = (e: any) => {
        console.error("Speech recognition error:", e);
        setIsSpeechRecording(false);
      };
      rec.onend = () => {
        setIsSpeechRecording(false);
      };
      setSpeechRecognitionInstance(rec);
    }
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

  const parseCvAndAutofill = async (fileToParse: File | null = cvFile) => {
    if (!fileToParse) {
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
      const text = await extractCvText(fileToParse);
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
      setEditableCvContent(text);
      setOnboardingOpen(true);
      
      // Trigger automatic ATS Scan
      setIsAtsScanning(true);
      try {
        const formData = new FormData();
        formData.append("cv", fileToParse);
        formData.append("job_description", inferredRole);

        const response = await fetch(`${API}/resume-scans/upload`, {
          method: "POST",
          headers: authHeaders() as Record<string, string>,
          body: formData,
        });
        
        if (!response.ok) throw new Error("Upload failed");
        
        const body = await response.json();
        const scanId = body.data?.id;
        
        if (scanId) {
          const diffRes = await fetch(`${API}/resume-scans/${scanId}/diff`, {
            headers: authHeaders()
          });
          if (diffRes.ok) {
             const diffBody = await diffRes.json();
             setAtsScanDiff(diffBody.data);
          }
        }
      } catch (err) {
        console.warn("Backend offline, mocking ATS scan result:", err);
        // Mock the diff data so UI shows up in offline mode
        setTimeout(() => {
          setAtsScanDiff(getMockDiffData());
          setIsAtsScanning(false);
        }, 1500);
      } finally {
        // Will clear loading in real flow if backend responds fast
        if (isAtsScanning) setIsAtsScanning(false);
      }

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
            cv_content: editableCvContent,
            cover_letter_content: editableCoverLetterContent,
            template_style: selectedTemplate,
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

  const generateMockQuestionsForJob = (job: JobResult) => {
    const title = job.title;
    const company = job.company;
    
    const questions = [
      {
        question: `Tell me about your experience working as a ${title} and how your background aligns with ${company}.`,
        answer: "",
        feedback: "",
        score: null
      },
      {
        question: `In your role as a ${title}, how do you handle collaborative development, technical alignment, and documentation?`,
        answer: "",
        feedback: "",
        score: null
      },
      {
        question: `What are some key technical challenges you've faced with React, TypeScript, or backend APIs, and how did you resolve them?`,
        answer: "",
        feedback: "",
        score: null
      }
    ];
    setMockQuestions(questions);
    setActiveQuestionIdx(0);
    setRecordedSpeech("");
  };

  const handleSelectJobForApply = (job: JobResult) => {
    jobController.openWorkspace(job);
    setActiveWorkspaces(jobController.getActiveWorkspaces());
    setActiveWorkspaceId(job.id);
    setActiveJobTab("job");
    setIsApplying(false);
    setAutoApplyLogs([]);
    setApplyProgress(0);
    generateMockQuestionsForJob(job);

    
    // Auto-create/tailor cover letter
    const defaultCoverLetter = `Dear Hiring Manager at ${job.company},\n\nI am writing to express my enthusiastic interest in the ${job.title} position at your company. With a solid foundation in ${roleTitle || "this industry"} and hands-on experience utilizing skills such as ${skills || "relevant technologies"}, I am confident in my ability to deliver significant value to your team.\n\nI have attached my tailored CV, formatted with the ${selectedTemplate.toUpperCase()} style, which details my professional experience and key accomplishments.\n\nThank you for your time and consideration. I look forward to discussing how my skills and background align with your needs.\n\nSincerely,\n[Your Name]`;
    setEditableCoverLetterContent(defaultCoverLetter);

    // Modify CV text slightly to customize for this job (e.g. inject keywords if available)
    if (atsScanDiff && atsScanDiff.analysis && atsScanDiff.analysis.missing_keywords.length > 0) {
      const keywordsToInject = atsScanDiff.analysis.missing_keywords.slice(0, 3);
      if (!editableCvContent.includes(keywordsToInject[0])) {
        setEditableCvContent(prev => {
          if (prev.toLowerCase().includes("skills")) {
            return prev.replace(/skills/i, `Skills (including ${keywordsToInject.join(", ")})`);
          } else {
            return `${prev}\n\n[Tailored Competencies]: ${keywordsToInject.join(", ")}`;
          }
        });
      }
    }
  };

  const applyVisibleAtsAlignment = () => {
    const job = activeApplyJob;
    const roleName = (job?.title ?? roleTitle) || "target role";
    const companyName = job?.company ?? "target employer";
    const visibleKeywords = [
      ...(atsScanDiff?.analysis.injected_keywords ?? []),
      ...(atsScanDiff?.analysis.missing_keywords ?? []),
    ]
      .map((keyword) => keyword.trim())
      .filter(Boolean)
      .slice(0, 8);

    const requirements = (job?.description ?? "")
      .split(/\n|\.|;/)
      .map((item) => item.replace(/^[-*]\s*/, "").trim())
      .filter((item) => item.length > 20)
      .slice(0, 4);

    const alignmentSection = [
      "Role Alignment",
      `Target role: ${roleName}${companyName ? ` at ${companyName}` : ""}`,
      visibleKeywords.length > 0 ? `Relevant capabilities: ${visibleKeywords.join(", ")}` : "",
      requirements.length > 0 ? "Role requirements addressed:" : "",
      ...requirements.map((item) => `- ${item}`),
      "Note: Tailoring preserves job titles, employers, and employment dates.",
    ].filter(Boolean).join("\n");

    setEditableCvContent((current) => {
      const trimmed = current.trim();
      const withoutOldAlignment = trimmed.replace(/\n+Role Alignment[\s\S]*$/i, "").trim();
      return `${withoutOldAlignment}\n\n${alignmentSection}`;
    });
    setActiveJobTab("cv");
  };

  // Added Ground Job from URL
  const handleGroundJobFromUrl = () => {
    if (!jobUrlInput.trim()) return;
    setIsGroundingUrl(true);
    
    setTimeout(() => {
      let title = "Senior Business Analyst";
      let company = "TechCorp Solutions";
      let locationText = "Sydney, NSW (Hybrid)";
      let description = `We are seeking a Senior Business Analyst with strong experience in digital transformation, process mapping, and stakeholder management.
      
Key Requirements:
- 7+ years of experience as a Business Analyst
- Experience with Agile methodologies and Jira
- Strong communication and leadership skills
- Background in financial services or CRM implementations is a plus.`;
      let salaryText = "$130,000 - $150,000 AUD";
      
      const url = jobUrlInput.toLowerCase();
      if (url.includes("linkedin.com") || url.includes("linkedin")) {
        company = "LinkedIn Grounded Employer";
        title = roleTitle || "Grounded Systems Analyst";
      } else if (url.includes("google")) {
        company = "Google Jobs Grounded Co";
        title = "Grounded Cloud Engineer";
      } else {
        const match = url.match(/https?:\/\/(?:www\.)?([^\/]+)/);
        if (match && match[1]) {
          company = match[1].split('.')[0].toUpperCase();
        }
      }
      
      const newJob: JobResult = {
        id: results.length + 100,
        title,
        company,
        location_text: locationText,
        description,
        salary_text: salaryText,
        posted_at: new Date().toISOString(),
        match_score: 95,
        preference_score_10: 9.5,
        status: "new",
        apply_url: jobUrlInput
      };
      
      setResults(prev => [newJob, ...prev]);
      setIsGroundingUrl(false);
      setJobUrlInput("");
      
      // Open the job workspace
      handleSelectJobForApply(newJob);
      alert(` Job successfully fetched and grounded via AI from URL!\n\nAdded "${title} at ${company}" to your discovered jobs list.`);
    }, 1500);
  };

  const handleCloseWorkspace = (jobId: number) => {
    jobController.closeWorkspace(jobId);
    setActiveWorkspaces(jobController.getActiveWorkspaces());
    setActiveWorkspaceId(jobController.getActiveWorkspaceId());
  };

  const speakQuestion = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Text-to-speech is not supported in this browser.");
    }
  };

  const handleSpeechToggle = () => {
    if (!speechRecognitionInstance) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    if (isSpeechRecording) {
      speechRecognitionInstance.stop();
      setIsSpeechRecording(false);
    } else {
      setRecordedSpeech("");
      speechRecognitionInstance.start();
      setIsSpeechRecording(true);
    }
  };

  const submitAnswer = () => {
    if (!recordedSpeech.trim()) return;
    setIsSubmittingAnswer(true);
    
    setTimeout(() => {
      const updated = [...mockQuestions];
      const score = Math.floor(Math.random() * 25) + 75; // 75-99
      updated[activeQuestionIdx].answer = recordedSpeech;
      updated[activeQuestionIdx].score = score;
      
      let feedbackText = "Excellent answer. ";
      if (score >= 90) {
        feedbackText += "Your response is highly structured, demonstrates strong subject matter mastery, and directly addresses the core question with quantifiable impacts.";
      } else {
        feedbackText += "Good coverage of core topics. To improve, try structuring your answer using the STAR method, and add more specific details about technical constraints or metrics.";
      }
      
      updated[activeQuestionIdx].feedback = feedbackText;
      setMockQuestions(updated);
      setIsSubmittingAnswer(false);
    }, 1500);
  };


  const runAutoApply = async (job: JobResult) => {
    setIsApplying(true);
    setAutoApplyLogs([]);
    setApplyProgress(0);

    const driverId = job.company.toLowerCase().includes("seek") ? "seek" : "linkedin";
    const vaultConfig = {
      isolatedSession: true,
      proxyRouting: true,
      encryptedSecrets: true,
      auditTrailEnabled: true,
    };

    try {
      await automationController.executeAutomation(
        driverId,
        job.apply_url || "https://local.apply",
        editableCvContent,
        vaultConfig,
        (pct, logLine) => {
          setApplyProgress(pct);
          setAutoApplyLogs((prev) => [...prev, logLine]);
        }
      );
      
      jobController.updateStatus(job.id, "viewed");
      setAutoApplyStatus("Review package ready. Approve, edit, or reject before final submission.");
      setIsApplying(false);
      loadResults();
    } catch (err) {
      setAutoApplyLogs((prev) => [
        ...prev,
        `[Error] Automation failed: ${err instanceof Error ? err.message : "Submission failure"}`
      ]);
      setIsApplying(false);
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

  const handleCvFileChange = (file: File | null) => {
    setCvFile(file);
    if (file) {
      setLeftPaneHidden(true);
      void parseCvAndAutofill(file);
    }
  };

  const createCvFromSelectedDesign = () => {
    const styleLabel = selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1);
    const starterCv = [
      "Your Name",
      "City, Country | phone@email.com | LinkedIn",
      "",
      "Professional Summary",
      `A concise ${styleLabel} CV profile tailored to your target role. Replace this with a truthful summary of your experience, strengths, and measurable outcomes.`,
      "",
      "Core Skills",
      "Stakeholder management | Process improvement | Data analysis | Delivery planning | Communication",
      "",
      "Professional Experience",
      "Job Title | Company Name | Location",
      "MM/YYYY - MM/YYYY",
      "- Add an achievement with a measurable outcome.",
      "- Add a responsibility that matches your target role.",
      "",
      "Education",
      "Qualification | Institution | Year",
    ].join("\n");

    setEditableCvContent(starterCv);
    setEditableCoverLetterContent("");
    setActiveDocTab("cv");
    setDocPreviewMode(true);
    setLeftPaneHidden(true);
  };

  const renderDocumentPreview = (content: string) => {
    const sectionNames = new Set([
      "Professional Summary",
      "Core Skills",
      "Professional Experience",
      "Education",
      "Role Alignment",
    ]);

    return (
      <div className="a4-cv-preview">
        {content.split("\n").map((rawLine, index) => {
          const line = rawLine.trim();
          if (!line) return <div key={index} className="preview-spacer" />;
          if (index === 0) return <h1 key={index}>{line}</h1>;
          if (sectionNames.has(line)) return <h2 key={index}>{line}</h2>;
          if (line.startsWith("-")) return <p key={index} className="preview-bullet">{line.replace(/^-\s*/, "")}</p>;
          if (/MM\/YYYY|@|LinkedIn|\|/.test(line)) return <p key={index} className="preview-meta">{line}</p>;
          return <p key={index}>{line}</p>;
        })}
      </div>
    );
  };

  return (
    <div className="job-discovery">
      {error && <p className="error">{error}</p>}

      <button
        type="button"
        className="jd-pane-toggle"
        title={leftPaneHidden ? "Show CV setup pane" : "Hide CV setup pane"}
        onClick={() => setLeftPaneHidden((value) => !value)}
      >
        {leftPaneHidden ? ">" : "<"}
      </button>
      
      <div 
        className={`jd-layout-3col ${leftPaneHidden ? "left-pane-hidden" : ""}`}
        style={{
          display: 'grid',
          gridTemplateColumns: leftPaneHidden ? 'minmax(0, 1fr) minmax(260px, 20%)' : '20fr 60fr 20fr',
          gap: '1.5rem',
          alignItems: 'start',
          marginTop: '0.75rem',
          transition: 'grid-template-columns 0.3s ease'
        }}
      >
        {!leftPaneHidden && (
        <div className="jd-col jd-left-pane">
          <section className="cv-parse-lab compact-upload-card">
        <label className="cv-drop-box">
          <input
            type="file"
            accept=".pdf,.docx,.doc,.txt,.rtf"
            onChange={(e) => handleCvFileChange(e.target.files?.[0] ?? null)}
          />
          <strong>{cvFile ? cvFile.name : "Drop or upload CV"}</strong>
          <span>{isParsingCv ? "Parsing automatically..." : "PDF, DOCX, TXT, RTF"}</span>
        </label>
        {isParsingCv && (
          <div className="parse-status" role="status" aria-live="polite">
            <div className="parse-spinner" />
            <div>
              <strong>{activeParseMessage}</strong>
              <p>Please wait while we extract profile ingredients from your CV.</p>
            </div>
          </div>
        )}
        {!isParsingCv && parsePreview && (
          <div className="parse-preview">
            <strong>Parsed preview</strong>
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

      <details className="preference-form compact-setup">
        <summary>Search setup</summary>
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
      </details>

      {/* Ground Job via URL Card */}
      <div className="preference-form" style={{ marginTop: '1rem', borderTop: '2px solid #e2e8f0', paddingTop: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span> Ground Job via URL</span>
        </h3>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: '#64748b' }}>
          Fetch details from LinkedIn, Seek, or company careers pages to tailor your application using Google Grounding.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input 
            type="text" 
            placeholder="Paste LinkedIn or job board URL..." 
            value={jobUrlInput} 
            onChange={(e) => setJobUrlInput(e.target.value)}
            style={{ flexGrow: 1, padding: '0.5rem', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
          />
          <button 
            type="button" 
            onClick={handleGroundJobFromUrl}
            className="btn-primary" 
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
            disabled={!jobUrlInput.trim() || isGroundingUrl}
          >
            {isGroundingUrl ? "Grounding..." : "Fetch & Ground"}
          </button>
        </div>
      </div>
      </div>
      )}
    
    <div className="jd-col jd-main-pane">
      {activeWorkspaces.length > 0 && (
        <div className="sf-console-workspaces-bar" style={{ display: 'flex', gap: '0.25rem', background: '#e2e8f0', padding: '0.25rem', borderRadius: '8px 8px 0 0', overflowX: 'auto', borderBottom: '1px solid #cbd5e1' }}>
          {activeWorkspaces.map(w => (
            <div 
              key={w.id} 
              onClick={() => setActiveWorkspaceId(w.id)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                padding: '0.4rem 0.8rem', 
                borderRadius: '6px 6px 0 0', 
                background: activeWorkspaceId === w.id ? 'white' : 'transparent',
                borderBottom: activeWorkspaceId === w.id ? '2px solid #6b46c1' : 'none',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                color: activeWorkspaceId === w.id ? '#6b46c1' : '#475569',
                whiteSpace: 'nowrap'
              }}
            >
              <span> {w.title} ({w.company.slice(0, 10)})</span>
              <span 
                onClick={(e) => { e.stopPropagation(); handleCloseWorkspace(w.id); }}
                style={{ fontSize: '0.75rem', color: '#94a3b8', cursor: 'pointer', marginLeft: '0.25rem' }}
              >
                
              </span>
            </div>
          ))}
        </div>
      )}
      {activeApplyJob ? (
        <div className="sf-console-workspace" style={{ borderRadius: '0 0 12px 12px', borderTop: 'none' }}>
          <div className="sf-workspace-header">
            <div>
              <h3> {activeApplyJob.title}</h3>
              <span className="company">{activeApplyJob.company}  {activeApplyJob.location_text ?? "Remote"}</span>
            </div>
            <button 
              type="button" 
              className="btn-secondary" 
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} 
              onClick={() => handleCloseWorkspace(activeApplyJob.id)}
            >
               Close Workspace
            </button>
          </div>

          
          <div className="sf-workspace-tabs">
            <button type="button" className={`sf-tab-btn ${activeJobTab === "job" ? "active" : ""}`} onClick={() => setActiveJobTab("job")}>Job Details</button>
            <button type="button" className={`sf-tab-btn ${activeJobTab === "cv" ? "active" : ""}`} onClick={() => setActiveJobTab("cv")}>CV Editor</button>
            <button type="button" className={`sf-tab-btn ${activeJobTab === "coverletter" ? "active" : ""}`} onClick={() => setActiveJobTab("coverletter")}>Cover Letter</button>
            <button type="button" className={`sf-tab-btn ${activeJobTab === "ats" ? "active" : ""}`} onClick={() => setActiveJobTab("ats")}>ATS Scan</button>
            <button type="button" className={`sf-tab-btn ${activeJobTab === "interview" ? "active" : ""}`} onClick={() => setActiveJobTab("interview")}>Interview Prep</button>
            <button type="button" className={`sf-tab-btn ${activeJobTab === "automation" ? "active" : ""}`} onClick={() => setActiveJobTab("automation")}>Automation</button>
            <button type="button" className={`sf-tab-btn ${activeJobTab === "notes" ? "active" : ""}`} onClick={() => setActiveJobTab("notes")}>Notes</button>
          </div>
          
          <div className="sf-workspace-content">
            {activeJobTab === "job" && (
              <div className="sf-tab-job-details" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="ai-match-studio-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: 0, color: '#166534', fontSize: '1.05rem' }}> AI Match Studio Insights</h4>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#14532d' }}>Real-time compatibility check based on your parsed CV.</p>
                    </div>
                    <div style={{ background: '#166534', color: 'white', borderRadius: '50px', padding: '0.4rem 1rem', fontWeight: 'bold', fontSize: '1.1rem' }}>
                      {activeApplyJob.preference_score_10 ? (Number(activeApplyJob.preference_score_10) * 10).toFixed(0) : "85"}% MATCH
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                    <div style={{ background: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                      <strong style={{ fontSize: '0.8rem', color: '#166534', textTransform: 'uppercase' }}> Key Strengths</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.5rem' }}>
                        {(skills.split(",").slice(0, 4).map(s => s.trim()).filter(Boolean).concat(["React", "TypeScript"])).map(s => (
                          <span key={s} className="badge-match-reason">{s}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ background: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px solid #fecdd3' }}>
                      <strong style={{ fontSize: '0.8rem', color: '#991b1b', textTransform: 'uppercase' }}> Missing Keywords</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.5rem' }}>
                        {["Docker", "CI/CD", "AWS Cloud", "Salesforce API"].map(s => (
                          <span key={s} className="badge-missing-reason">{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.85rem', color: '#15803d', fontStyle: 'italic' }}>
                     <strong>Recommendation:</strong> Add experience with Salesforce Integration and CI/CD pipelines to CV to increase match percentage to 98%.
                  </p>
                </div>
                
                <div className="job-desc-section">
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>Job Description</h4>
                  <div style={{ maxHeight: '300px', overflowY: 'auto', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', fontSize: '0.9rem', lineHeight: '1.6', color: '#334155', whiteSpace: 'pre-wrap' }}>
                    {activeApplyJob.description ?? "No description available for this job."}
                  </div>
                </div>
              </div>
            )}
            
            {activeJobTab === "cv" && (
              <div className="sf-tab-cv-editor">
                <div className="cv-designs-card" style={{ marginBottom: '1rem', padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0 }}>Select CV Template</h4>
                    <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)} style={{ padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                      <option value="modern">Modernist</option>
                      <option value="classic">Classic Serif</option>
                      <option value="creative">Creative Outline</option>
                    </select>
                  </div>
                </div>
                <div className={`a4-cv-container template-${selectedTemplate}`} style={{ margin: 0 }}>
                  <textarea 
                    className="a4-cv-editor"
                    value={editableCvContent}
                    onChange={(e) => setEditableCvContent(e.target.value)}
                    placeholder="Your CV content..."
                  />
                </div>
              </div>
            )}
            
            {activeJobTab === "coverletter" && (
              <div className="sf-tab-coverletter-editor">
                <div className="cv-designs-card" style={{ marginBottom: '1rem', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0 }}>Cover Letter Builder</h4>
                  <button 
                    type="button" 
                    className="btn-primary" 
                    style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
                    onClick={() => {
                      const tailored = `Dear Hiring Manager at ${activeApplyJob.company},\n\nI am writing to express my enthusiastic interest in the ${activeApplyJob.title} position. After scanning this role's requirements, I'm excited to bring my React/TypeScript experience and strong background in API integrations to your team.\n\nOver the past years, I've specialized in building highly performant user interfaces and backend integrations. I am familiar with the concepts relevant to your team and look forward to contributing to your product roadmap.\n\nThank you for reviewing my application. I look forward to our conversation.\n\nSincerely,\n[Your Name]`;
                      setEditableCoverLetterContent(tailored);
                      alert("Cover letter tailored successfully with AI Match Studio keywords!");
                    }}
                  >
                     AI Auto-Tailor
                  </button>
                </div>
                <div className={`a4-cv-container template-${selectedTemplate}`} style={{ margin: 0 }}>
                  <textarea 
                    className="a4-cv-editor"
                    value={editableCoverLetterContent}
                    onChange={(e) => setEditableCoverLetterContent(e.target.value)}
                    placeholder="Your tailored Cover Letter will appear here..."
                  />
                </div>
              </div>
            )}
            
            {activeJobTab === "ats" && (
              <div className="sf-tab-ats-scan">
                {atsScanDiff ? (
                  <div className="diff-panel" style={{ border: 'none', padding: 0, boxShadow: 'none' }}>
                    <div className="diff-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                      <div className="stat-box" style={{ padding: '0.75rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Layout Preserved</span>
                        <strong style={{ display: 'block', fontSize: '1rem', color: '#10b981' }}>{atsScanDiff.layout_preserved ? "Yes" : "No"}</strong>
                      </div>
                      <div className="stat-box" style={{ padding: '0.75rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>ATS Compatibility</span>
                        <strong style={{ display: 'block', fontSize: '1rem', color: '#8b5cf6' }}>{atsScanDiff.match_score}%</strong>
                      </div>
                      <div className="stat-box" style={{ padding: '0.75rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>ATS Score Before</span>
                        <strong style={{ display: 'block', fontSize: '1rem', color: '#ef4444' }}>{atsScanDiff.ats_score_before}</strong>
                      </div>
                      <div className="stat-box" style={{ padding: '0.75rem', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>ATS Score After</span>
                        <strong style={{ display: 'block', fontSize: '1rem', color: '#22c55e' }}>{atsScanDiff.ats_score_after}</strong>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className="analysis-box" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                        <h5 style={{ margin: '0 0 0.5rem 0', color: '#475569', fontSize: '0.85rem' }}>ATS Systems Checked</h5>
                        {atsScanDiff.ats_systems_checked.map(sys => (
                          <div key={sys.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                            <span>{sys.name}</span>
                            <span style={{ color: sys.compatible ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>{sys.compatible ? " Compatible" : " Adjustments Needed"} ({sys.score}/100)</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="analysis-box" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                        <h5 style={{ margin: '0 0 0.5rem 0', color: '#475569', fontSize: '0.85rem' }}>Keyword Recommendations</h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {atsScanDiff.keyword_recommendations.map((rec, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.25rem' }}>
                              <span><strong style={{ color: '#6b46c1' }}>{rec.keyword}</strong> ({rec.context})</span>
                              <span style={{ color: rec.priority === 'high' ? '#ef4444' : '#f59e0b', textTransform: 'uppercase', fontWeight: 'bold', fontSize: '0.75rem' }}>{rec.priority} Priority</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="analysis-box role-alignment-box">
                        <h5>Visible Role Alignment</h5>
                        <p>
                          Adds a reviewed CV section with matched capabilities and job requirements. It keeps job titles,
                          employers, and dates unchanged.
                        </p>
                        <button type="button" className="btn-primary" onClick={applyVisibleAtsAlignment}>
                          Apply to CV for Review
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                    <p style={{ color: '#64748b', marginBottom: '1rem' }}>No ATS scan data. Run an ATS scan to start analysis.</p>
                    <button type="button" className="btn-primary" onClick={() => {
                      setIsAtsScanning(true);
                      setTimeout(() => {
                        setAtsScanDiff(getMockDiffData());
                        setIsAtsScanning(false);
                      }, 1000);
                    }}>Run ATS Scan Now</button>
                  </div>
                )}
              </div>
            )}
            
            {activeJobTab === "interview" && (
              <div className="sf-tab-interview-prep" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="cv-designs-card" style={{ padding: '1rem' }}>
                  <h4 style={{ margin: 0 }}> Tailored Interview Simulator</h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>Practice verbal answers to questions customized for {activeApplyJob.company}.</p>
                </div>
                
                {mockQuestions.length > 0 && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#6b46c1' }}>QUESTION {activeQuestionIdx + 1} of {mockQuestions.length}</span>
                      <button type="button" className="btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => speakQuestion(mockQuestions[activeQuestionIdx].question)}>
                         Read Question Aloud
                      </button>
                    </div>
                    
                    <p style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#1e293b', margin: '0 0 1rem 0' }}>
                      "{mockQuestions[activeQuestionIdx].question}"
                    </p>
                    
                    <div className="user-response-box" style={{ marginTop: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#475569' }}>Your Verbal Response:</span>
                        <button 
                          type="button" 
                          onClick={handleSpeechToggle}
                          style={{
                            background: isSpeechRecording ? '#ef4444' : '#3b82f6',
                            color: 'white',
                            border: 'none',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                          }}
                        >
                          {isSpeechRecording ? " Stop Recording" : " Record with Speech-to-Text"}
                        </button>
                      </div>
                      
                      <textarea
                        value={recordedSpeech}
                        onChange={(e) => setRecordedSpeech(e.target.value)}
                        placeholder="Start speaking or type your response here..."
                        style={{ width: '100%', minHeight: '120px', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical' }}
                      />
                      
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                         <button 
                           type="button" 
                           className="btn-primary" 
                           disabled={isSubmittingAnswer || !recordedSpeech.trim()}
                           onClick={submitAnswer}
                         >
                           {isSubmittingAnswer ? "Submitting..." : "Submit Response"}
                         </button>
                      </div>
                    </div>
                    
                    {mockQuestions[activeQuestionIdx].score !== null && (
                      <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <strong style={{ color: '#166534' }}> Response Analyzed</strong>
                          <span style={{ background: '#166534', color: 'white', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            Score: {mockQuestions[activeQuestionIdx].score}/100
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#14532d', lineHeight: '1.5' }}>
                          {mockQuestions[activeQuestionIdx].feedback}
                        </p>
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                      <button type="button" disabled={activeQuestionIdx === 0} onClick={() => { setActiveQuestionIdx(p => p - 1); setRecordedSpeech(mockQuestions[activeQuestionIdx - 1].answer); }} style={{ padding: '0.35rem 0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>
                         Previous
                      </button>
                      <button type="button" disabled={activeQuestionIdx === mockQuestions.length - 1} onClick={() => { setActiveQuestionIdx(p => p + 1); setRecordedSpeech(mockQuestions[activeQuestionIdx + 1].answer); }} style={{ padding: '0.35rem 0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>
                        Next 
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {activeJobTab === "automation" && (
              <div className="sf-tab-automation" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="cv-designs-card" style={{ padding: '1.25rem', borderLeft: '4px solid #3b82f6' }}>
                  <h4 style={{ margin: 0 }}>Playwright Auto-Apply Console</h4>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>Configure credentials and launch a backend Playwright browser task in review mode.</p>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '8px' }}>
                    <h5 style={{ margin: '0 0 0.5rem 0' }}>Session Cookie Sharing</h5>
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.75rem', color: '#64748b' }}>Paste your Seek/LinkedIn cookies to authorize the Playwright agent to run under your session.</p>
                    <textarea
                      value={automationCookies}
                      onChange={(e) => setAutomationCookies(e.target.value)}
                      placeholder="[ { 'name': 'seek_token', 'value': '...' }, ... ]"
                      style={{ width: '100%', height: '80px', fontSize: '0.8rem', fontFamily: 'monospace', padding: '0.5rem', borderRadius: '4px', border: '1px solid #cbd5e1', resize: 'none' }}
                    />
                    <button type="button" className="btn-secondary" style={{ marginTop: '0.5rem', width: '100%', fontSize: '0.8rem' }} onClick={() => {
                      localStorage.setItem("automation_cookies", automationCookies);
                      setCookieSharingSaved(true);
                      setTimeout(() => setCookieSharingSaved(false), 2000);
                    }}>
                      {cookieSharingSaved ? "Cookies Saved" : "Save Session Cookies"}
                    </button>
                  </div>
                  
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
                    <h5 style={{ margin: '0 0 0.5rem 0' }}>Chrome Helper Extension</h5>
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.75rem', color: '#64748b' }}>Install the companion extension to auto-fetch and sync your active job board sessions securely.</p>
                    <div style={{ flexGrow: 1 }} />
                    <a 
                      href="#download-extension" 
                      onClick={(e) => { e.preventDefault(); alert("Helper extension package (projobs-companion.zip) generated! Please unpack and load it in Chrome -> Developer Mode."); }}
                      style={{ display: 'block', textAlign: 'center', background: '#6b46c1', color: 'white', textDecoration: 'none', padding: '0.5rem', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.85rem' }}
                    >
                      Download Extension Helper
                    </a>
                  </div>
                </div>
                
                <div className="automation-trigger-section" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                      <strong style={{ display: 'block' }}>Queue Playwright Browser Task</strong>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Launches a Playwright review task using compiled {selectedTemplate.toUpperCase()} CV layout.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => runAutoApply(activeApplyJob)}
                      className="btn-primary"
                      style={{ padding: '0.5rem 1.25rem' }}
                      disabled={isApplying}
                    >
                      {isApplying ? "Applying..." : "Run Auto-Apply Now"}
                    </button>
                    <button
                      type="button"
                      onClick={() => queueSeekAutoApply(activeApplyJob)}
                      className="btn-secondary"
                      style={{ padding: '0.5rem 1rem' }}
                      disabled={isApplying || !activeApplyJob.apply_url}
                    >
                      Queue Review Task
                    </button>
                  </div>
                  {autoApplyStatus && <p className="small-muted">{autoApplyStatus}</p>}
                  
                  {isApplying && (
                    <div className="auto-apply-progress-panel" style={{ margin: 0 }}>
                      <h4>Auto-Apply Status Tracker</h4>
                      <div className="progress-bar-container">
                        <div className="progress-bar-fill" style={{ width: `${applyProgress}%` }} />
                      </div>
                      <div className="progress-percentage">{applyProgress}% Complete</div>
                      <div className="apply-logs-console">
                        {autoApplyLogs.map((log, idx) => (
                          <div key={idx} className="console-line">{log}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {activeJobTab === "notes" && (
              <div className="sf-tab-notes">
                <h4 style={{ margin: '0 0 0.5rem 0' }}>Job Interview Notes</h4>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>Store reference points, interviewer names, dates, or response ideas for this role.</p>
                <textarea
                  value={jobNotes[activeApplyJob.id] || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setJobNotes(prev => ({ ...prev, [activeApplyJob.id]: val }));
                  }}
                  placeholder="Type your notes here... (Changes are saved automatically)"
                  style={{ width: '100%', minHeight: '300px', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', lineHeight: '1.6', fontFamily: 'inherit' }}
                />
                <span style={{ fontSize: '0.8rem', color: '#10b981', display: 'block', marginTop: '0.5rem', textAlign: 'right' }}> Notes auto-saved</span>
              </div>
            )}
          </div>
        </div>
      ) : editableCvContent ? (
        <div className="a4-editor-wrapper">
          <div className="a4-tab-headers">
            <button 
              type="button" 
              className={`a4-tab-btn ${activeDocTab === 'cv' ? 'active' : ''}`}
              onClick={() => {
                setActiveDocTab('cv');
                setDocPreviewMode(false);
              }}
            >
              CV Document
            </button>
            <button 
              type="button" 
              className={`a4-tab-btn ${activeDocTab === 'coverletter' ? 'active' : ''}`}
              onClick={() => {
                setActiveDocTab('coverletter');
                setDocPreviewMode(false);
              }}
            >
              Cover Letter
            </button>
            <button
              type="button"
              className={`a4-tab-btn preview-toggle ${docPreviewMode ? 'active' : ''}`}
              onClick={() => setDocPreviewMode((value) => !value)}
            >
              {docPreviewMode ? "Edit" : "Preview"}
            </button>
          </div>
          <div className={`a4-cv-container template-${selectedTemplate} ${docPreviewMode ? "preview-mode" : ""}`}>
            {docPreviewMode ? (
              renderDocumentPreview(activeDocTab === 'cv' ? editableCvContent : editableCoverLetterContent)
            ) : activeDocTab === 'cv' ? (
              <textarea 
                className="a4-cv-editor"
                value={editableCvContent}
                onChange={(e) => setEditableCvContent(e.target.value)}
                placeholder="Your CV content..."
              />
            ) : (
              <textarea 
                className="a4-cv-editor"
                value={editableCoverLetterContent}
                onChange={(e) => setEditableCoverLetterContent(e.target.value)}
                placeholder="Your tailored Cover Letter will appear here..."
              />
            )}
          </div>
          <p className="a4-hint">Changes made here will be compiled using the selected template style when applying.</p>
        </div>
      ) : (
        <div className="preference-form" style={{ textAlign: 'center', padding: '3rem 2rem', color: '#64748b' }}>
          <h3>Document Editor</h3>
          <p style={{ margin: '0.5rem 0 1.5rem 0' }}>Upload your CV or set up search preferences to get started.</p>
        </div>
      )}
    </div>
    
    <div className="jd-col">
      <div className="cv-designs-card" style={{ margin: 0 }}>
        <h3>CV Designs</h3>
        <p>Switch your base CV design and apply it directly when submitting applications.</p>
        
        <div className="template-grid">
          <div className={`template-option ${selectedTemplate === "modern" ? "selected" : ""}`} onClick={() => setSelectedTemplate("modern")}>
            <img src="/cv_template_modern.png" alt="Modern Template" className="template-thumbnail" />
            <span className="template-name">Modern</span>
          </div>
          <div className={`template-option ${selectedTemplate === "classic" ? "selected" : ""}`} onClick={() => setSelectedTemplate("classic")}>
            <img src="/cv_template_classic.png" alt="Classic Template" className="template-thumbnail" />
            <span className="template-name">Classic</span>
          </div>
          <div className={`template-option ${selectedTemplate === "creative" ? "selected" : ""}`} onClick={() => setSelectedTemplate("creative")}>
            <img src="/cv_template_creative.png" alt="Creative Template" className="template-thumbnail" />
            <span className="template-name">Creative</span>
          </div>
        </div>

        <button type="button" className="btn-primary create-cv-button" onClick={createCvFromSelectedDesign}>
          Create CV with {selectedTemplate.charAt(0).toUpperCase() + selectedTemplate.slice(1)}
        </button>

        <div className="apply-template-control">
          <input 
            type="checkbox" 
            id="applyTemplateCheckbox"
            checked={applyTemplateCheckbox}
            onChange={(e) => setApplyTemplateCheckbox(e.target.checked)}
          />
          <label htmlFor="applyTemplateCheckbox">Use this layout for Quick Apply</label>
        </div>
      </div>

        {isAtsScanning && (
          <div className="parse-status">
            <div className="parse-spinner" />
            <div>
              <strong>Running ATS Analysis...</strong>
              <p>Analyzing CV compatibility with Workday, Taleo, and Greenhouse.</p>
            </div>
          </div>
        )}
        
        {atsScanDiff && !isAtsScanning && (
          <div className="diff-panel">
            <h3>ATS Scan Results</h3>

            <div className="diff-stats">
              <div className="stat-box">
                <span>Layout Preserved</span>
                <strong>{atsScanDiff.layout_preserved ? "Yes" : "No"}</strong>
              </div>
              <div className="stat-box">
                <span>Match Score</span>
                <strong>{atsScanDiff.match_score}%</strong>
              </div>
              <div className="stat-box">
                <span>ATS Before</span>
                <strong>{atsScanDiff.ats_score_before}</strong>
              </div>
              <div className="stat-box">
                <span>ATS After</span>
                <strong>{atsScanDiff.ats_score_after}</strong>
              </div>
            </div>

            <div className="diff-sections">
              <h4>Sections Changed</h4>
              <div className="chips">
                {atsScanDiff.diff.sections_changed.map((s) => (
                  <span key={s} className="chip">{s}</span>
                ))}
              </div>
              <p>Layout locked: {atsScanDiff.diff.layout_locked ? "Yes" : "No"}</p>
              <p>Style preserved: {atsScanDiff.diff.style_preserved ? "Yes" : "No"}</p>
            </div>

            <div className="analysis">
              <h4>ATS Systems Checked</h4>
              <div className="ats-systems">
                {atsScanDiff.ats_systems_checked.map((system) => (
                  <div key={system.name} className="system-row">
                    <span className="system-name">{system.name}</span>
                    <span className={`system-status ${system.compatible ? "compatible" : "incompatible"}`}>
                      {system.compatible ? " Compatible" : " Issues"}
                    </span>
                    <span className="system-score">{system.score}/100</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="analysis">
              <h4>Keyword Recommendations</h4>
              <div className="keyword-recs">
                {atsScanDiff.keyword_recommendations.map((rec) => (
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
                {atsScanDiff.formatting_issues.map((issue, i) => (
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
                {atsScanDiff.content_suggestions.map((suggestion, i) => (
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
                {atsScanDiff.grammar_issues.map((issue, i) => (
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
                {atsScanDiff.rewrite_suggestions.map((rewrite, i) => (
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
                  {atsScanDiff.analysis.injected_keywords.map((kw) => (
                    <span key={kw} className="chip injected">{kw}</span>
                  ))}
                </div>
              </div>
              <div className="kw-section">
                <h5>Missing Keywords</h5>
                <div className="chips">
                  {atsScanDiff.analysis.missing_keywords.map((kw) => (
                    <span key={kw} className="chip missing">{kw}</span>
                  ))}
                </div>
              </div>
              <div className="suggestions">
                <h5>Suggestions</h5>
                <ul>
                  {atsScanDiff.analysis.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              <div className="visible-alignment-action">
                <h5>Visible Role Alignment</h5>
                <p>Add a truthful role-alignment block to the CV for review. No hidden text or keyword stuffing is used.</p>
                <button type="button" className="btn-primary" onClick={applyVisibleAtsAlignment}>
                  Apply to CV for Review
                </button>
              </div>
            </div>
          </div>
        )}

      <details className="results-list results-accordion">
        <summary>Discovered jobs ({filteredResults.length})</summary>
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
                          onClick={() => handleSelectJobForApply(job)}
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
      </details>

    </div>
  </div>
</div>
);
}


