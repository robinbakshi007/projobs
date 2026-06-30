// services/JobService.ts
import { platformKernel } from "../core/PlatformKernel";
import { eventBus } from "../core/EventBus";

export interface JobResult {
  id: number;
  title: string;
  company: string;
  location_text: string | null;
  description: string | null;
  salary_text: string | null;
  posted_at: string | null;
  match_score: number;
  preference_score_10?: number | string | null;
  status: string;
  apply_url: string | null;
}

export interface MatchAnalysis {
  matchPercent: number;
  reasons: string[];
  missingSkills: string[];
  suggestedAction: string;
}

class JobService {
  private activeWorkspaces: JobResult[] = [];
  private activeWorkspaceId: number | null = null;
  private results: JobResult[] = [];

  constructor() {
    this.loadMockResults();
  }

  public getActiveWorkspaces(): JobResult[] {
    return this.activeWorkspaces;
  }

  public getActiveWorkspaceId(): number | null {
    return this.activeWorkspaceId;
  }

  public getResults(): JobResult[] {
    return this.results;
  }

  public openWorkspace(job: JobResult): void {
    if (!this.activeWorkspaces.some((w) => w.id === job.id)) {
      this.activeWorkspaces.push(job);
    }
    this.activeWorkspaceId = job.id;
    eventBus.publish("job.selected", job);
  }

  public closeWorkspace(jobId: number): void {
    this.activeWorkspaces = this.activeWorkspaces.filter((w) => w.id !== jobId);
    if (this.activeWorkspaceId === jobId) {
      this.activeWorkspaceId = this.activeWorkspaces[0]?.id || null;
    }
    eventBus.publish("document.updated", { jobId, type: "workspace_closed" });
  }

  public getMatchAnalysis(job: JobResult): MatchAnalysis {
    const score = job.preference_score_10 ? Number(job.preference_score_10) * 10 : 85;
    
    // Custom tailored mock analysis based on job details
    const reasons = ["React", "TypeScript", "Frontend Engineering", "Salesforce API"];
    const missingSkills = ["Docker Containers", "CI/CD Orchestration", "AWS Cloud Infrastructure"];
    const suggestedAction = `Incorporate experience with Salesforce API integrations, Docker packaging, and AWS Lambda deployments in your resume body to raise the match score to 98%.`;

    return {
      matchPercent: score,
      reasons,
      missingSkills,
      suggestedAction,
    };
  }

  public updateJobStatus(jobId: number, status: string): void {
    this.results = this.results.map((j) => (j.id === jobId ? { ...j, status } : j));
    this.activeWorkspaces = this.activeWorkspaces.map((j) => (j.id === jobId ? { ...j, status } : j));
    eventBus.publish("analytics.refreshed", { jobId, status });
  }

  private loadMockResults() {
    this.results = [
      {
        id: 1,
        title: "Staff Frontend Engineer",
        company: "Atlassian",
        location_text: "Remote (Australia)",
        description: "We are seeking a Staff Frontend Engineer with deep expertise in React, TypeScript, and state management. You will design, build, and lead complex wizard-based UIs and visual components. Prior experience with CI/CD, AWS deployments, and unit test automation is highly desirable.",
        salary_text: "$160K - $180K",
        posted_at: new Date().toISOString(),
        match_score: 9.7,
        preference_score_10: 9.7,
        status: "new",
        apply_url: "https://www.atlassian.com/careers",
      },
      {
        id: 2,
        title: "Senior UI Developer",
        company: "Canva",
        location_text: "Sydney (Hybrid)",
        description: "Join Canva as a Senior UI Developer. You will spearhead React optimizations, manage design systems library integrations, and scale user onboarding experiences. Knowledge of responsive grid styling, canvas APIs, and Cypress/Playwright is preferred.",
        salary_text: "$140K - $150K",
        posted_at: new Date().toISOString(),
        match_score: 9.2,
        preference_score_10: 9.2,
        status: "new",
        apply_url: "https://www.canva.com/careers",
      },
      {
        id: 3,
        title: "React Dev (Salesforce CRM)",
        company: "Hydro Tasmania",
        location_text: "Hobart (Onsite)",
        description: "Seeking a React Developer with Salesforce integration capabilities. Build customized Sales and Service cloud visual consoles, link recruiter APIs, and optimize dashboards pipelines.",
        salary_text: "$115K",
        posted_at: new Date().toISOString(),
        match_score: 8.6,
        preference_score_10: 8.6,
        status: "viewed",
        apply_url: "https://www.hydro.com.au/careers",
      },
    ];
  }
}

export const jobService = new JobService();
platformKernel.registerService("JobService", jobService);
