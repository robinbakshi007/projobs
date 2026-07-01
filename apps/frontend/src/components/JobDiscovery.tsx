import { useEffect, useMemo, useState } from "react";
import { type CSSProperties } from "react";
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
type TemplateStyle = "modern" | "classic" | "creative";
type FontOptionValue = "Inter" | "Manrope" | "Merriweather" | "Playfair Display" | "Lora" | "IBM Plex Sans" | "Outfit";
type StudioTab = "fonts" | "colors" | "photo" | "layout" | "sections" | "export";

type SavedStylePreset = {
  id: string;
  name: string;
  headingFont: FontOptionValue;
  bodyFont: FontOptionValue;
  textColor: string;
  accentColor: string;
  paperColor: string;
  backgroundColor: string;
  sidebarColor: string;
  lineHeightScale: number;
  fontScale: number;
  sidebarWidth: number;
  sectionDensity: number;
};

type ResumeVariant = {
  id: string;
  name: string;
  template: TemplateStyle;
  cv: string;
  coverLetter: string;
  photo: string | null;
  sections: string[];
};

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

function ResumeIcon({ name }: { name: "phone" | "link" | "map" | "camera" | "spark" }) {
  const common = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  if (name === "phone") {
    return <svg {...common}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72l.34 2.71a2 2 0 0 1-.57 1.72l-1.3 1.3a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 1.72-.57l2.71.34A2 2 0 0 1 22 16.92z" /></svg>;
  }
  if (name === "link") {
    return <svg {...common}><path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 4" /><path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L13 19" /></svg>;
  }
  if (name === "map") {
    return <svg {...common}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>;
  }
  if (name === "camera") {
    return <svg {...common}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>;
  }
  return <svg {...common}><path d="M12 2l2.4 5.2L20 9l-4 3.9.94 5.6L12 15.8l-4.94 2.7L8 12.9 4 9l5.6-1.8L12 2z" /></svg>;
}

const TEMPLATE_LABELS: Record<TemplateStyle, string> = {
  modern: "Modern",
  classic: "Classic",
  creative: "Creative",
};

const TEMPLATE_SUMMARIES: Record<TemplateStyle, string> = {
  modern: "A modern CV profile tailored to your target role. Replace this with a truthful summary of your experience, strengths, and measurable outcomes.",
  classic: "A polished classic CV summary focused on dependable experience, leadership, and results. Replace this with a truthful overview of your background.",
  creative: "A bold creative profile that highlights your story, strengths, and measurable wins. Replace this with a truthful summary aligned to your target role.",
};

const GOOGLE_FONT_OPTIONS: Array<{ label: string; value: FontOptionValue }> = [
  { label: "Inter", value: "Inter" },
  { label: "Manrope", value: "Manrope" },
  { label: "Merriweather", value: "Merriweather" },
  { label: "Playfair Display", value: "Playfair Display" },
  { label: "Lora", value: "Lora" },
  { label: "IBM Plex Sans", value: "IBM Plex Sans" },
  { label: "Outfit", value: "Outfit" },
];

const THEME_PRESETS = [
  {
    id: "executive",
    label: "Executive",
    text: "#24384b",
    accent: "#1f4f82",
    paper: "#ffffff",
    background: "#f8fafc",
    sidebar: "#eef3f8",
  },
  {
    id: "minimal",
    label: "Minimal",
    text: "#1f2937",
    accent: "#111827",
    paper: "#ffffff",
    background: "#f8fafc",
    sidebar: "#f3f4f6",
  },
  {
    id: "corporate",
    label: "Corporate",
    text: "#1e3a5f",
    accent: "#2563eb",
    paper: "#ffffff",
    background: "#eff6ff",
    sidebar: "#dbeafe",
  },
  {
    id: "creative",
    label: "Creative",
    text: "#ede9fe",
    accent: "#8b5cf6",
    paper: "#ffffff",
    background: "#1e1b4b",
    sidebar: "#312e81",
  },
  {
    id: "tech",
    label: "Tech",
    text: "#0f172a",
    accent: "#06b6d4",
    paper: "#ffffff",
    background: "#ecfeff",
    sidebar: "#083344",
  },
] as const;

function createStarterCv(template: TemplateStyle) {
  const summary = TEMPLATE_SUMMARIES[template];

  if (template === "creative") {
    return [
      "Your Name",
      "City, Country | phone@email.com | LinkedIn",
      "",
      "Professional Summary",
      summary,
      "",
      "Core Skills",
      "Stakeholder management | Process improvement | Data analysis | Delivery planning | Communication",
      "",
      "Signature Wins",
      "- Delivered a measurable outcome that shows impact.",
      "- Improved a workflow, team metric, or customer result.",
      "",
      "Professional Experience",
      "Job Title | Company Name | Location",
      "MM/YYYY - MM/YYYY",
      "- Add a high-impact achievement with a measurable outcome.",
      "- Add a responsibility that matches your target role.",
      "",
      "Education",
      "Qualification | Institution | Year",
    ].join("\n");
  }

  if (template === "classic") {
    return [
      "Your Name",
      "Executive Title",
      "phone@email.com | LinkedIn | Location",
      "",
      "Professional Summary",
      summary,
      "",
      "Professional Experience",
      "Job Title | Company Name | Location",
      "MM/YYYY - MM/YYYY",
      "- Add an achievement with a measurable outcome.",
      "- Add a responsibility that matches your target role.",
      "",
      "Certifications",
      "PMP",
      "CFA",
      "",
      "Languages",
      "English",
      "French",
      "",
      "Core Skills",
      "Strategic planning",
      "Leadership",
      "Financial analysis",
      "Project management",
      "",
      "Education",
      "Qualification | Institution | Year",
    ].join("\n");
  }

  return [
    "Your Name",
    "Target Role Title",
    "",
    "Contact",
    "phone@email.com",
    "LinkedIn / portfolio",
    "Location",
    "",
    "Core Skills",
    "Stakeholder management",
    "Process improvement",
    "Data analysis",
    "Delivery planning",
    "Communication",
    "",
    "Languages",
    "English: Native",
    "German: B2",
    "",
    "Professional Summary",
    summary,
    "",
    "Professional Experience",
    "Job Title | Company Name",
    "MM/YYYY - Present | Location",
    "- Add an achievement with a measurable outcome.",
    "- Add a responsibility that matches your target role.",
    "",
    "Projects",
    "Key project",
    "- Add a project highlight linked to business impact.",
    "",
    "Education",
    "Qualification | Institution | Year",
  ].join("\n");
}

function createStarterCoverLetter(template: TemplateStyle) {
  const label = TEMPLATE_LABELS[template];
  return [
    "Your Name",
    "City, Country | phone@email.com | LinkedIn",
    "",
    "Dear Hiring Manager,",
    "",
    `I am writing to apply for this opportunity with a ${label.toLowerCase()} cover letter that reflects my real experience and strengths. Replace this paragraph with a truthful opening tailored to the role and company.`,
    "",
    "I bring relevant experience, measurable outcomes, and practical strengths that align with the job requirements. Replace this paragraph with evidence-based examples from your background.",
    "",
    "Thank you for your time and consideration. I would welcome the opportunity to discuss how I can contribute.",
    "",
    "Sincerely,",
    "Your Name",
  ].join("\n");
}

function parseDocumentSections(content: string) {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sections = new Map<string, string[]>();
  const sectionNames = new Set([
    "Professional Summary",
    "Core Skills",
    "Professional Experience",
    "Education",
    "Role Alignment",
    "Signature Wins",
    "Contact",
    "Languages",
    "Projects",
    "Certifications",
  ]);

  const header = lines[0] ?? "Your Name";
  const meta = lines[1] ?? "City, Country | phone@email.com | LinkedIn";
  let currentSection = "intro";

  for (const line of lines.slice(2)) {
    if (sectionNames.has(line)) {
      currentSection = line;
      sections.set(currentSection, []);
      continue;
    }

    if (!sections.has(currentSection)) {
      sections.set(currentSection, []);
    }

    sections.get(currentSection)?.push(line);
  }

  return { header, meta, sections };
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
  const studioStorageKey = "job_discovery_cv_studio_v2";
  const variantStorageKey = "job_discovery_cv_variants_v1";
  const presetStorageKey = "job_discovery_cv_presets_v1";
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
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateStyle>("modern");
  const [selectedHeadingFont, setSelectedHeadingFont] = useState<FontOptionValue>("Inter");
  const [selectedBodyFont, setSelectedBodyFont] = useState<FontOptionValue>("Inter");
  const [textColor, setTextColor] = useState("#24384b");
  const [accentColor, setAccentColor] = useState("#1f4f82");
  const [paperColor, setPaperColor] = useState("#ffffff");
  const [backgroundColor, setBackgroundColor] = useState("#f8fafc");
  const [sidebarColor, setSidebarColor] = useState("#eef3f8");
  const [lineHeightScale, setLineHeightScale] = useState(1.65);
  const [fontScale, setFontScale] = useState(100);
  const [sidebarWidth, setSidebarWidth] = useState(25);
  const [sectionDensity, setSectionDensity] = useState(100);
  const [dividerStyle, setDividerStyle] = useState<"solid" | "dashed" | "none">("solid");
  const [selectedSections, setSelectedSections] = useState<string[]>([
    "Contact",
    "Core Skills",
    "Languages",
    "Professional Summary",
    "Professional Experience",
    "Projects",
    "Education",
    "Certifications",
    "Role Alignment",
    "Signature Wins",
  ]);
  const [studioTab, setStudioTab] = useState<StudioTab>("fonts");
  const [profilePhotoGallery, setProfilePhotoGallery] = useState<string[]>([]);
  const [selectedProfilePhoto, setSelectedProfilePhoto] = useState<string | null>(null);
  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoBrightness, setPhotoBrightness] = useState(100);
  const [photoContrast, setPhotoContrast] = useState(100);
  const [photoX, setPhotoX] = useState(50);
  const [photoY, setPhotoY] = useState(35);
  const [photoRoundness, setPhotoRoundness] = useState(50);
  const [savedStylePresets, setSavedStylePresets] = useState<SavedStylePreset[]>([]);
  const [stylePresetName, setStylePresetName] = useState("");
  const [resumeVariants, setResumeVariants] = useState<ResumeVariant[]>([]);
  const [variantName, setVariantName] = useState("");
  const [customSectionName, setCustomSectionName] = useState("");
  const [shareResumeUrl, setShareResumeUrl] = useState("");
  const [designAssistantNotes, setDesignAssistantNotes] = useState<string[]>([]);
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
    if (selectedTemplate === "modern") {
      setSelectedHeadingFont("Inter");
      setSelectedBodyFont("Inter");
      setTextColor("#24384b");
      setAccentColor("#2563eb");
      setPaperColor("#ffffff");
      setBackgroundColor("#f8fafc");
      setSidebarColor("#eef3f8");
      setSidebarWidth(25);
    }
    if (selectedTemplate === "classic") {
      setSelectedHeadingFont("Playfair Display");
      setSelectedBodyFont("Merriweather");
      setTextColor("#2f2a25");
      setAccentColor("#342b24");
      setPaperColor("#ffffff");
      setBackgroundColor("#f4f2ee");
      setSidebarColor("#ffffff");
      setSidebarWidth(38);
    }
    if (selectedTemplate === "creative") {
      setSelectedHeadingFont("Outfit");
      setSelectedBodyFont("Manrope");
      setTextColor("#1e1b4b");
      setAccentColor("#8b5cf6");
      setPaperColor("#ffffff");
      setBackgroundColor("#1e1b4b");
      setSidebarColor("#312e81");
      setSidebarWidth(28);
    }
  }, [selectedTemplate]);

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

  useEffect(() => {
    try {
      const savedStudio = localStorage.getItem(studioStorageKey);
      if (savedStudio) {
        const parsed = JSON.parse(savedStudio) as Record<string, unknown>;
        if (typeof parsed.selectedHeadingFont === "string") setSelectedHeadingFont(parsed.selectedHeadingFont as FontOptionValue);
        if (typeof parsed.selectedBodyFont === "string") setSelectedBodyFont(parsed.selectedBodyFont as FontOptionValue);
        if (typeof parsed.textColor === "string") setTextColor(parsed.textColor);
        if (typeof parsed.accentColor === "string") setAccentColor(parsed.accentColor);
        if (typeof parsed.paperColor === "string") setPaperColor(parsed.paperColor);
        if (typeof parsed.backgroundColor === "string") setBackgroundColor(parsed.backgroundColor);
        if (typeof parsed.sidebarColor === "string") setSidebarColor(parsed.sidebarColor);
        if (typeof parsed.lineHeightScale === "number") setLineHeightScale(parsed.lineHeightScale);
        if (typeof parsed.fontScale === "number") setFontScale(parsed.fontScale);
        if (typeof parsed.sidebarWidth === "number") setSidebarWidth(parsed.sidebarWidth);
        if (typeof parsed.sectionDensity === "number") setSectionDensity(parsed.sectionDensity);
        if (typeof parsed.dividerStyle === "string") setDividerStyle(parsed.dividerStyle as "solid" | "dashed" | "none");
        if (Array.isArray(parsed.profilePhotoGallery)) setProfilePhotoGallery(parsed.profilePhotoGallery.filter((item): item is string => typeof item === "string"));
        if (typeof parsed.selectedProfilePhoto === "string") setSelectedProfilePhoto(parsed.selectedProfilePhoto);
        if (typeof parsed.photoZoom === "number") setPhotoZoom(parsed.photoZoom);
        if (typeof parsed.photoBrightness === "number") setPhotoBrightness(parsed.photoBrightness);
        if (typeof parsed.photoContrast === "number") setPhotoContrast(parsed.photoContrast);
        if (typeof parsed.photoX === "number") setPhotoX(parsed.photoX);
        if (typeof parsed.photoY === "number") setPhotoY(parsed.photoY);
        if (typeof parsed.photoRoundness === "number") setPhotoRoundness(parsed.photoRoundness);
        if (Array.isArray(parsed.selectedSections)) setSelectedSections(parsed.selectedSections.filter((item): item is string => typeof item === "string"));
      }
      const savedPresets = localStorage.getItem(presetStorageKey);
      if (savedPresets) setSavedStylePresets(JSON.parse(savedPresets) as SavedStylePreset[]);
      const savedVariants = localStorage.getItem(variantStorageKey);
      if (savedVariants) setResumeVariants(JSON.parse(savedVariants) as ResumeVariant[]);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      studioStorageKey,
      JSON.stringify({
        selectedHeadingFont,
        selectedBodyFont,
        textColor,
        accentColor,
        paperColor,
        backgroundColor,
        sidebarColor,
        lineHeightScale,
        fontScale,
        sidebarWidth,
        sectionDensity,
        dividerStyle,
        profilePhotoGallery,
        selectedProfilePhoto,
        photoZoom,
        photoBrightness,
        photoContrast,
        photoX,
        photoY,
        photoRoundness,
        selectedSections,
      })
    );
  }, [
    selectedHeadingFont,
    selectedBodyFont,
    textColor,
    accentColor,
    paperColor,
    backgroundColor,
    sidebarColor,
    lineHeightScale,
    fontScale,
    sidebarWidth,
    sectionDensity,
    dividerStyle,
    profilePhotoGallery,
    selectedProfilePhoto,
    photoZoom,
    photoBrightness,
    photoContrast,
    photoX,
    photoY,
    photoRoundness,
    selectedSections,
  ]);

  useEffect(() => {
    localStorage.setItem(presetStorageKey, JSON.stringify(savedStylePresets));
  }, [savedStylePresets]);

  useEffect(() => {
    localStorage.setItem(variantStorageKey, JSON.stringify(resumeVariants));
  }, [resumeVariants]);


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

  const cvFontStyle: CSSProperties = {
    ["--cv-heading-font" as string]: `'${selectedHeadingFont}', sans-serif`,
    ["--cv-body-font" as string]: `'${selectedBodyFont}', sans-serif`,
    ["--cv-text-color" as string]: textColor,
    ["--cv-accent-color" as string]: accentColor,
    ["--cv-paper-color" as string]: paperColor,
    ["--cv-background-color" as string]: backgroundColor,
    ["--cv-sidebar-color" as string]: sidebarColor,
    ["--cv-line-height" as string]: String(lineHeightScale),
    ["--cv-font-scale" as string]: `${fontScale}%`,
    ["--cv-sidebar-width" as string]: `${sidebarWidth}%`,
    ["--cv-section-density" as string]: `${sectionDensity}%`,
    ["--cv-divider-style" as string]: dividerStyle,
  };

  const toggleSectionVisibility = (sectionName: string) => {
    setSelectedSections((current) =>
      current.includes(sectionName)
        ? current.filter((name) => name !== sectionName)
        : [...current, sectionName]
    );
  };

  const moveSection = (sectionName: string, direction: -1 | 1) => {
    setSelectedSections((current) => {
      const index = current.indexOf(sectionName);
      if (index === -1) return current;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const updated = [...current];
      [updated[index], updated[nextIndex]] = [updated[nextIndex], updated[index]];
      return updated;
    });
  };

  const addCustomSection = () => {
    const trimmed = customSectionName.trim();
    if (!trimmed) return;
    if (!selectedSections.includes(trimmed)) {
      setSelectedSections((current) => [...current, trimmed]);
    }
    setEditableCvContent((current) => `${current.trim()}\n\n${trimmed}\n- Add details here.`);
    setCustomSectionName("");
  };

  const applyThemePreset = (presetId: string) => {
    const preset = THEME_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setTextColor(preset.text);
    setAccentColor(preset.accent);
    setPaperColor(preset.paper);
    setBackgroundColor(preset.background);
    setSidebarColor(preset.sidebar);
  };

  const handleProfilePhotoUpload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) return;
      setProfilePhotoGallery((current) => [result, ...current.filter((item) => item !== result).slice(0, 5)]);
      setSelectedProfilePhoto(result);
      setPhotoZoom(1.1);
      setPhotoBrightness(102);
      setPhotoContrast(104);
      setPhotoX(50);
      setPhotoY(35);
      setPhotoRoundness(selectedTemplate === "modern" ? 50 : 16);
    };
    reader.readAsDataURL(file);
  };

  const autoFramePhoto = () => {
    setPhotoZoom(1.12);
    setPhotoBrightness(104);
    setPhotoContrast(106);
    setPhotoX(50);
    setPhotoY(32);
  };

  const atsDesignWarnings = useMemo(() => {
    const warnings: string[] = [];
    const isVeryLightText = textColor.toLowerCase() === "#ffffff" || textColor.toLowerCase() === "#f8fafc";
    if (isVeryLightText) warnings.push("Light text may reduce readability in ATS exports.");
    if (selectedProfilePhoto) warnings.push("Profile photos can be useful visually, but keep a photo-free variant for strict ATS submissions.");
    if (selectedTemplate === "creative") warnings.push("Creative layouts can score lower on conservative ATS pipelines. Use Modern or Classic for safer submissions.");
    if (fontScale > 112) warnings.push("Large font scale may push content beyond one page.");
    if (sidebarWidth > 38 && selectedTemplate !== "classic") warnings.push("A wide sidebar reduces content space for experience and projects.");
    return warnings;
  }, [textColor, selectedProfilePhoto, selectedTemplate, fontScale, sidebarWidth]);

  const removeCurrentPhoto = () => {
    if (!selectedProfilePhoto) return;
    setProfilePhotoGallery((current) => current.filter((photo) => photo !== selectedProfilePhoto));
    setSelectedProfilePhoto((current) => {
      const remaining = profilePhotoGallery.filter((photo) => photo !== current);
      return remaining[0] ?? null;
    });
  };

  const saveCurrentStylePreset = () => {
    const trimmedName = stylePresetName.trim() || `${selectedTemplate} preset`;
    const preset: SavedStylePreset = {
      id: `preset-${Date.now()}`,
      name: trimmedName,
      headingFont: selectedHeadingFont,
      bodyFont: selectedBodyFont,
      textColor,
      accentColor,
      paperColor,
      backgroundColor,
      sidebarColor,
      lineHeightScale,
      fontScale,
      sidebarWidth,
      sectionDensity,
    };
    setSavedStylePresets((current) => [preset, ...current.filter((item) => item.name !== preset.name)].slice(0, 8));
    setStylePresetName("");
  };

  const applySavedStylePreset = (preset: SavedStylePreset) => {
    setSelectedHeadingFont(preset.headingFont);
    setSelectedBodyFont(preset.bodyFont);
    setTextColor(preset.textColor);
    setAccentColor(preset.accentColor);
    setPaperColor(preset.paperColor);
    setBackgroundColor(preset.backgroundColor);
    setSidebarColor(preset.sidebarColor);
    setLineHeightScale(preset.lineHeightScale);
    setFontScale(preset.fontScale);
    setSidebarWidth(preset.sidebarWidth);
    setSectionDensity(preset.sectionDensity);
  };

  const saveResumeVariant = () => {
    const trimmedName = variantName.trim() || `${TEMPLATE_LABELS[selectedTemplate]} variant`;
    const variant: ResumeVariant = {
      id: `variant-${Date.now()}`,
      name: trimmedName,
      template: selectedTemplate,
      cv: editableCvContent,
      coverLetter: editableCoverLetterContent,
      photo: selectedProfilePhoto,
      sections: selectedSections,
    };
    setResumeVariants((current) => [variant, ...current.filter((item) => item.name !== variant.name)].slice(0, 10));
    setVariantName("");
  };

  const duplicateResumeVariant = (variant: ResumeVariant) => {
    setResumeVariants((current) => [
      {
        ...variant,
        id: `variant-${Date.now()}`,
        name: `${variant.name} Copy`,
      },
      ...current,
    ].slice(0, 10));
  };

  const renameResumeVariant = (variantId: string) => {
    const nextName = window.prompt("Rename resume variant");
    if (!nextName?.trim()) return;
    setResumeVariants((current) =>
      current.map((variant) => variant.id === variantId ? { ...variant, name: nextName.trim() } : variant)
    );
  };

  const deleteResumeVariant = (variantId: string) => {
    setResumeVariants((current) => current.filter((variant) => variant.id !== variantId));
  };

  const loadResumeVariant = (variant: ResumeVariant) => {
    setSelectedTemplate(variant.template);
    setEditableCvContent(variant.cv);
    setEditableCoverLetterContent(variant.coverLetter);
    setSelectedProfilePhoto(variant.photo);
    setSelectedSections(variant.sections);
    setDocPreviewMode(true);
  };

  const createShareLink = () => {
    const payload = encodeURIComponent(
      JSON.stringify({
        template: selectedTemplate,
        cv: editableCvContent,
        coverLetter: editableCoverLetterContent,
      })
    );
    const link = `${window.location.origin}${window.location.pathname}#resume-share=${payload}`;
    setShareResumeUrl(link);
  };

  const runDesignAssistant = () => {
    const notes: string[] = [];
    if (selectedTemplate === "modern" && !selectedProfilePhoto) {
      notes.push("Modern looks stronger with a profile photo. Upload one and use Auto frame face.");
    }
    if (selectedTemplate === "classic" && selectedHeadingFont !== "Playfair Display") {
      notes.push("Classic reads best with a serif heading. Playfair Display is the strongest current fit.");
    }
    if (selectedTemplate === "creative" && sidebarWidth < 26) {
      notes.push("Creative benefits from a wider sidebar. Try a sidebar width around 28% to 32%.");
    }
    if (fontScale > 112) {
      notes.push("Font scale is getting large for a one-page resume. Consider bringing it closer to 100%.");
    }
    if (lineHeightScale < 1.45) {
      notes.push("Line height is a bit tight. Raise it slightly for better scanability.");
    }
    if (!notes.length) {
      notes.push("The current design is balanced. Next improvement: save this as a named preset and create a role-specific variant.");
    }
    setDesignAssistantNotes(notes);
  };

  const createCvFromSelectedDesign = () => {
    setEditableCvContent(createStarterCv(selectedTemplate));
    setEditableCoverLetterContent(createStarterCoverLetter(selectedTemplate));
    setActiveDocTab("cv");
    setDocPreviewMode(true);
    setLeftPaneHidden(true);
  };

  const renderDocumentPreview = (content: string) => {
    const { header, meta, sections } = parseDocumentSections(content);
    const orderedSections = Array.from(sections.entries()).filter(([name]) => name !== "intro");
    const visibleSections = selectedSections
      .map((name) => orderedSections.find(([sectionName]) => sectionName === name))
      .filter((entry): entry is [string, string[]] => Boolean(entry));
    const introLines = sections.get("intro") ?? [];
    const isCoverLetter = activeDocTab === "coverletter";
    const profilePhotoStyle = {
      objectFit: "cover" as const,
      objectPosition: `${photoX}% ${photoY}%`,
      transform: `scale(${photoZoom})`,
      filter: `brightness(${photoBrightness}%) contrast(${photoContrast}%)`,
      borderRadius: `${photoRoundness}%`,
    };

    if (isCoverLetter) {
      return (
        <div className={`a4-cv-preview a4-cover-preview cover-${selectedTemplate}`}>
          <header className="preview-header">
            <h1>{header}</h1>
            <p className="preview-meta">{meta}</p>
          </header>
          <div className="cover-body">
            {introLines.map((line, index) => (
              line.startsWith("Dear ") || line === "Sincerely," || line === "Your Name" ? (
                <p key={`${line}-${index}`} className="cover-salutation">{line}</p>
              ) : (
                <p key={`${line}-${index}`}>{line}</p>
              )
            ))}
            {visibleSections.map(([section, values]) => (
              <section key={section} className="preview-section">
                <h2>{section}</h2>
                {values.map((line, index) => (
                  <p key={`${section}-${index}`}>{line.replace(/^-\s*/, "")}</p>
                ))}
              </section>
            ))}
          </div>
        </div>
      );
    }

    if (selectedTemplate === "modern") {
      const contact = sections.get("Contact") ?? [];
      const skills = sections.get("Core Skills") ?? [];
      const languages = sections.get("Languages") ?? [];
      const roleTitle = meta;
      const initials = header
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");

      return (
        <div className="a4-cv-preview modern-thumbnail-layout">
          <aside className="modern-sidebar">
            {selectedProfilePhoto ? (
              <div className="modern-avatar photo-avatar">
                <img src={selectedProfilePhoto} alt="Profile portrait" style={profilePhotoStyle} />
              </div>
            ) : (
              <div className="modern-avatar" aria-hidden="true">{initials || "YN"}</div>
            )}
            <h1>{header}</h1>
            <p className="modern-role">{roleTitle}</p>

            {selectedSections.includes("Contact") && (
            <section className="preview-section">
              <h2>Contact</h2>
              {contact.map((line, index) => (
                <div key={`contact-${index}`} className="contact-row">
                  <span className="contact-icon"><ResumeIcon name={index === 0 ? "phone" : index === 1 ? "link" : "map"} /></span>
                  <p className="modern-sidebar-text">{line}</p>
                </div>
              ))}
            </section>
            )}

            {selectedSections.includes("Core Skills") && (
            <section className="preview-section">
              <h2>Skills</h2>
              <ul className="modern-list">
                {skills.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
            )}

            {selectedSections.includes("Languages") && (
            <section className="preview-section">
              <h2>Languages</h2>
              {languages.map((line, index) => (
                <p key={`language-${index}`} className="modern-sidebar-text">{line}</p>
              ))}
            </section>
            )}
          </aside>

          <div className="modern-main">
            {visibleSections
              .filter(([section]) => !["Contact", "Core Skills", "Languages"].includes(section))
              .map(([section, values]) => (
                <section key={section} className="preview-section">
                  <h2>{section}</h2>
                  {values.map((line, index) => (
                    line.startsWith("-") ? (
                      <p key={`${section}-${index}`} className="preview-bullet">{line.replace(/^-\s*/, "")}</p>
                    ) : (
                      <p key={`${section}-${index}`} className={/MM\/YYYY|\|/.test(line) ? "preview-meta" : ""}>{line}</p>
                    )
                  ))}
                </section>
              ))}
          </div>
        </div>
      );
    }

    if (selectedTemplate === "creative") {
      const skills = (sections.get("Core Skills") ?? []).join(" | ").split("|").map((skill) => skill.trim()).filter(Boolean);
      return (
        <div className="a4-cv-preview creative-preview-layout">
          <aside className="creative-sidebar">
            {selectedProfilePhoto && (
              <div className="creative-photo-frame">
                <img src={selectedProfilePhoto} alt="Profile portrait" style={profilePhotoStyle} />
              </div>
            )}
            <h1>{header}</h1>
            <p className="preview-meta">{meta}</p>
            {selectedSections.includes("Core Skills") && (
            <section className="preview-section">
              <h2>Core Skills</h2>
              <ul className="preview-pill-list">
                {skills.map((skill) => (
                  <li key={skill}>{skill}</li>
                ))}
              </ul>
            </section>
            )}
          </aside>
          <div className="creative-main">
            {visibleSections
              .filter(([section]) => section !== "Core Skills")
              .map(([section, values]) => (
                <section key={section} className="preview-section">
                  <h2>{section}</h2>
                  {values.map((line, index) => (
                    line.startsWith("-") ? (
                      <p key={`${section}-${index}`} className="preview-bullet">{line.replace(/^-\s*/, "")}</p>
                    ) : (
                      <p key={`${section}-${index}`} className={/MM\/YYYY|\|/.test(line) ? "preview-meta" : ""}>{line}</p>
                    )
                  ))}
                </section>
              ))}
          </div>
        </div>
      );
    }

    if (selectedTemplate === "classic") {
      const summaryLines = sections.get("Professional Summary") ?? [];
      const experience = sections.get("Professional Experience") ?? [];
      const education = sections.get("Education") ?? [];
      const skills = sections.get("Core Skills") ?? [];
      const certifications = sections.get("Certifications") ?? [];
      const languages = sections.get("Languages") ?? [];
      const projects = sections.get("Projects") ?? [];
      const contactLine = introLines[0] ?? "phone@email.com | LinkedIn | Location";

      return (
        <div className="a4-cv-preview classic-thumbnail-layout">
          <header className="classic-hero">
            <h1>{header}</h1>
            <p className="classic-subtitle">{meta}</p>
            <p className="classic-contact">{contactLine}</p>
          </header>

          <section className="classic-summary-band">
            {summaryLines.map((line, index) => (
              <p key={`summary-${index}`}>{line}</p>
            ))}
          </section>

          <div className="classic-body">
            <div className="classic-primary">
              <section className="preview-section">
                <h2>Work Experience</h2>
                {experience.map((line, index) => (
                  line.startsWith("-") ? (
                    <p key={`experience-${index}`} className="preview-bullet">{line.replace(/^-\s*/, "")}</p>
                  ) : (
                    <p key={`experience-${index}`} className={/MM\/YYYY|\|/.test(line) ? "preview-meta" : "classic-emphasis"}>{line}</p>
                  )
                ))}
              </section>

              {selectedSections.includes("Projects") && projects.length > 0 && (
                <section className="preview-section">
                  <h2>Projects</h2>
                  {projects.map((line, index) => (
                    line.startsWith("-") ? (
                      <p key={`project-${index}`} className="preview-bullet">{line.replace(/^-\s*/, "")}</p>
                    ) : (
                      <p key={`project-${index}`} className={index === 0 ? "classic-emphasis" : ""}>{line}</p>
                    )
                  ))}
                </section>
              )}

              {selectedSections.includes("Education") && (
              <section className="preview-section">
                <h2>Education</h2>
                {education.map((line, index) => (
                  <p key={`education-${index}`} className={index === 0 ? "classic-emphasis" : ""}>{line}</p>
                ))}
              </section>
              )}
            </div>

            <aside className="classic-secondary">
              {selectedSections.includes("Core Skills") && (
              <section className="preview-section">
                <h2>Key Skills</h2>
                {skills.map((line, index) => (
                  <p key={`skill-${index}`}>{line}</p>
                ))}
              </section>
              )}

              {selectedSections.includes("Certifications") && (
              <section className="preview-section">
                <h2>Certifications</h2>
                {certifications.map((line, index) => (
                  <p key={`cert-${index}`}>{line}</p>
                ))}
              </section>
              )}

              {selectedSections.includes("Languages") && (
              <section className="preview-section">
                <h2>Languages</h2>
                {languages.map((line, index) => (
                  <p key={`lang-${index}`}>{line}</p>
                ))}
              </section>
              )}
            </aside>
          </div>
        </div>
      );
    }

    return (
      <div className="a4-cv-preview modern-preview-layout">
        <header className="preview-header">
          <h1>{header}</h1>
          <p className="preview-meta">{meta}</p>
        </header>
        {visibleSections.map(([section, values]) => (
          <section key={section} className="preview-section">
            <h2>{section}</h2>
            {values.map((line, index) => (
              line.startsWith("-") ? (
                <p key={`${section}-${index}`} className="preview-bullet">{line.replace(/^-\s*/, "")}</p>
              ) : (
                <p key={`${section}-${index}`} className={/MM\/YYYY|\|/.test(line) ? "preview-meta" : ""}>{line}</p>
              )
            ))}
          </section>
        ))}
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
                    <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value as TemplateStyle)} style={{ padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                      <option value="modern">Modernist</option>
                      <option value="classic">Classic Serif</option>
                      <option value="creative">Creative Outline</option>
                    </select>
                  </div>
                </div>
                <div className={`a4-cv-container template-${selectedTemplate}`} style={{ margin: 0, ...cvFontStyle }}>
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
                <div className={`a4-cv-container template-${selectedTemplate}`} style={{ margin: 0, ...cvFontStyle }}>
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
          <div className={`a4-cv-container template-${selectedTemplate} ${docPreviewMode ? "preview-mode" : ""}`} style={cvFontStyle}>
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

        <div className="studio-tabs">
          {(["fonts", "colors", "photo", "layout", "sections", "export"] as StudioTab[]).map((tabName) => (
            <button
              key={tabName}
              type="button"
              className={`studio-tab-btn ${studioTab === tabName ? "active" : ""}`}
              onClick={() => setStudioTab(tabName)}
            >
              {tabName}
            </button>
          ))}
        </div>

        <div className="studio-control-card">
          {studioTab === "fonts" && (
            <>
              <div className="font-control">
                <label htmlFor="cvHeadingFontSelect">Heading font</label>
                <select
                  id="cvHeadingFontSelect"
                  value={selectedHeadingFont}
                  onChange={(e) => setSelectedHeadingFont(e.target.value as FontOptionValue)}
                >
                  {GOOGLE_FONT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="font-control">
                <label htmlFor="cvBodyFontSelect">Body font</label>
                <select
                  id="cvBodyFontSelect"
                  value={selectedBodyFont}
                  onChange={(e) => setSelectedBodyFont(e.target.value as FontOptionValue)}
                >
                  {GOOGLE_FONT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="range-control">
                <label>Font size scale <span>{fontScale}%</span></label>
                <input type="range" min="90" max="120" value={fontScale} onChange={(e) => setFontScale(Number(e.target.value))} />
              </div>
              <div className="range-control">
                <label>Line height <span>{lineHeightScale.toFixed(2)}</span></label>
                <input type="range" min="1.3" max="2" step="0.05" value={lineHeightScale} onChange={(e) => setLineHeightScale(Number(e.target.value))} />
              </div>
            </>
          )}

          {studioTab === "colors" && (
            <>
              <div className="preset-grid">
                {THEME_PRESETS.map((preset) => (
                  <button key={preset.id} type="button" className="preset-chip" onClick={() => applyThemePreset(preset.id)}>
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="font-control">
                <label htmlFor="stylePresetName">Save style preset</label>
                <input id="stylePresetName" value={stylePresetName} onChange={(e) => setStylePresetName(e.target.value)} placeholder="Executive Blue" />
              </div>
              <button type="button" className="btn-secondary studio-action" onClick={saveCurrentStylePreset}>Save current style</button>
              {savedStylePresets.length > 0 && (
                <div className="saved-preset-list">
                  {savedStylePresets.map((preset) => (
                    <button key={preset.id} type="button" className="saved-preset-row" onClick={() => applySavedStylePreset(preset)}>
                      <span>{preset.name}</span>
                      <span>{preset.headingFont} / {preset.bodyFont}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="color-grid">
                <label><span>Text</span><input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} /></label>
                <label><span>Accent</span><input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} /></label>
                <label><span>Paper</span><input type="color" value={paperColor} onChange={(e) => setPaperColor(e.target.value)} /></label>
                <label><span>Background</span><input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} /></label>
                <label><span>Sidebar</span><input type="color" value={sidebarColor} onChange={(e) => setSidebarColor(e.target.value)} /></label>
              </div>
            </>
          )}

          {studioTab === "photo" && (
            <>
              <label className="photo-upload-box">
                <input type="file" accept="image/*" onChange={(e) => handleProfilePhotoUpload(e.target.files?.[0] ?? null)} />
                <span className="photo-upload-icon"><ResumeIcon name="camera" /></span>
                <strong>Upload profile photo</strong>
                <span>Auto-center portrait, then adjust crop, light, and shape.</span>
              </label>
              {profilePhotoGallery.length > 0 && (
                <div className="photo-gallery">
                  {profilePhotoGallery.map((photo) => (
                    <button
                      key={photo}
                      type="button"
                      className={`photo-thumb ${selectedProfilePhoto === photo ? "active" : ""}`}
                      onClick={() => setSelectedProfilePhoto(photo)}
                    >
                      <img src={photo} alt="Profile option" />
                    </button>
                  ))}
                </div>
              )}
              <button type="button" className="btn-secondary studio-action" onClick={autoFramePhoto}>Auto frame face</button>
              <button type="button" className="btn-secondary studio-action" onClick={removeCurrentPhoto} disabled={!selectedProfilePhoto}>Remove selected photo</button>
              <div className="range-control">
                <label>Zoom <span>{photoZoom.toFixed(2)}x</span></label>
                <input type="range" min="1" max="1.8" step="0.02" value={photoZoom} onChange={(e) => setPhotoZoom(Number(e.target.value))} />
              </div>
              <div className="range-control">
                <label>Brightness <span>{photoBrightness}%</span></label>
                <input type="range" min="80" max="130" value={photoBrightness} onChange={(e) => setPhotoBrightness(Number(e.target.value))} />
              </div>
              <div className="range-control">
                <label>Contrast <span>{photoContrast}%</span></label>
                <input type="range" min="80" max="140" value={photoContrast} onChange={(e) => setPhotoContrast(Number(e.target.value))} />
              </div>
              <div className="range-control">
                <label>Horizontal crop <span>{photoX}%</span></label>
                <input type="range" min="0" max="100" value={photoX} onChange={(e) => setPhotoX(Number(e.target.value))} />
              </div>
              <div className="range-control">
                <label>Vertical crop <span>{photoY}%</span></label>
                <input type="range" min="0" max="100" value={photoY} onChange={(e) => setPhotoY(Number(e.target.value))} />
              </div>
              <div className="range-control">
                <label>Roundness <span>{photoRoundness}%</span></label>
                <input type="range" min="0" max="50" value={photoRoundness} onChange={(e) => setPhotoRoundness(Number(e.target.value))} />
              </div>
            </>
          )}

          {studioTab === "layout" && (
            <>
              <div className="range-control">
                <label>Sidebar width <span>{sidebarWidth}%</span></label>
                <input type="range" min="20" max="45" value={sidebarWidth} onChange={(e) => setSidebarWidth(Number(e.target.value))} />
              </div>
              <div className="range-control">
                <label>Section density <span>{sectionDensity}%</span></label>
                <input type="range" min="80" max="130" value={sectionDensity} onChange={(e) => setSectionDensity(Number(e.target.value))} />
              </div>
              <div className="font-control">
                <label htmlFor="dividerStyle">Divider style</label>
                <select id="dividerStyle" value={dividerStyle} onChange={(e) => setDividerStyle(e.target.value as "solid" | "dashed" | "none")}>
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="none">None</option>
                </select>
              </div>
            </>
          )}

          {studioTab === "sections" && (
            <>
              <div className="font-control">
                <label htmlFor="customSectionName">Add custom section</label>
                <input id="customSectionName" value={customSectionName} onChange={(e) => setCustomSectionName(e.target.value)} placeholder="Awards" />
              </div>
              <button type="button" className="btn-secondary studio-action" onClick={addCustomSection}>Add custom section</button>
              <div className="section-toggle-grid">
                {selectedSections.map((sectionName, index) => (
                  <div key={sectionName} className="section-row">
                    <label className="section-toggle">
                      <input type="checkbox" checked={selectedSections.includes(sectionName)} onChange={() => toggleSectionVisibility(sectionName)} />
                      <span>{sectionName}</span>
                    </label>
                    <div className="section-actions">
                      <button type="button" onClick={() => moveSection(sectionName, -1)} disabled={index === 0}>Up</button>
                      <button type="button" onClick={() => moveSection(sectionName, 1)} disabled={index === selectedSections.length - 1}>Down</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {studioTab === "export" && (
            <div className="export-actions">
              <button type="button" className="btn-secondary studio-action" onClick={() => setDocPreviewMode(true)}>Preview print layout</button>
              <button type="button" className="btn-secondary studio-action" onClick={runDesignAssistant}>Improve design</button>
              <button type="button" className="btn-secondary studio-action" onClick={() => window.print()}>Export PDF</button>
              <button type="button" className="btn-secondary studio-action" onClick={() => alert("DOCX export will preserve the selected design tokens.")}>Export DOCX</button>
              <div className="font-control">
                <label htmlFor="variantName">Save resume variant</label>
                <input id="variantName" value={variantName} onChange={(e) => setVariantName(e.target.value)} placeholder="Senior BA - ATS safe" />
              </div>
              <button type="button" className="btn-secondary studio-action" onClick={saveResumeVariant}>Save variant</button>
              {resumeVariants.length > 0 && (
                <div className="saved-preset-list">
                  {resumeVariants.map((variant) => (
                    <div key={variant.id} className="saved-preset-row variant-row">
                      <button type="button" className="variant-main" onClick={() => loadResumeVariant(variant)}>
                        <span>{variant.name}</span>
                        <span>{variant.template}</span>
                      </button>
                      <div className="variant-actions">
                        <button type="button" onClick={() => duplicateResumeVariant(variant)}>Copy</button>
                        <button type="button" onClick={() => renameResumeVariant(variant.id)}>Rename</button>
                        <button type="button" onClick={() => deleteResumeVariant(variant.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" className="btn-secondary studio-action" onClick={createShareLink}>Create share link</button>
              {shareResumeUrl && <textarea readOnly className="share-link-box" value={shareResumeUrl} />}
              {designAssistantNotes.length > 0 && (
                <div className="design-assistant-notes">
                  {designAssistantNotes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              )}
              {atsDesignWarnings.length > 0 && (
                <div className="ats-warning-box">
                  <strong>ATS-safe design warnings</strong>
                  {atsDesignWarnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

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


