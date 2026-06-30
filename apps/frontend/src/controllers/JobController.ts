// controllers/JobController.ts
import { platformKernel } from "../core/PlatformKernel";
import type { JobResult, MatchAnalysis } from "../services/JobService";

export class JobController {
  private service: any;

  constructor() {
    this.service = platformKernel.getService("JobService");
  }

  public getResults(): JobResult[] {
    return this.service.getResults();
  }

  public getActiveWorkspaces(): JobResult[] {
    return this.service.getActiveWorkspaces();
  }

  public getActiveWorkspaceId(): number | null {
    return this.service.getActiveWorkspaceId();
  }

  public openWorkspace(job: JobResult): void {
    this.service.openWorkspace(job);
  }

  public closeWorkspace(jobId: number): void {
    this.service.closeWorkspace(jobId);
  }

  public getMatchAnalysis(job: JobResult): MatchAnalysis {
    return this.service.getMatchAnalysis(job);
  }

  public updateStatus(jobId: number, status: string): void {
    this.service.updateJobStatus(jobId, status);
  }
}

export const jobController = new JobController();
