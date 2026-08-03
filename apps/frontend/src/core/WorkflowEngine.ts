// core/WorkflowEngine.ts
import { eventBus } from "./EventBus";

export interface WorkflowStep {
  id: string;
  name: string;
  status: "idle" | "running" | "completed" | "failed";
  error?: string;
  retryCount: number;
}

export interface WorkflowRun {
  id: string;
  jobId: number;
  steps: WorkflowStep[];
  currentStepIndex: number;
  status: "idle" | "running" | "completed" | "failed";
}

class WorkflowEngine {
  private activeRuns: Record<string, WorkflowRun> = {};

  public createRun(jobId: number, companyName: string): WorkflowRun {
    const steps: WorkflowStep[] = [
      { id: "find", name: "1. Match Analysis", status: "idle", retryCount: 0 },
      { id: "tailor", name: "2. Tailor Resume", status: "idle", retryCount: 0 },
      { id: "cover_letter", name: "3. Draft Cover Letter", status: "idle", retryCount: 0 },
      { id: "ats_verify", name: "4. Run ATS Check", status: "idle", retryCount: 0 },
      { id: "user_approve", name: "5. Wait for User Approval", status: "idle", retryCount: 0 },
      { id: "browser_apply", name: "6. Automation Submission", status: "idle", retryCount: 0 },
      { id: "follow_up", name: "7. Log Timeline Entry", status: "idle", retryCount: 0 },
    ];

    const runId = `wf-run-${Date.now()}-${jobId}`;
    const run: WorkflowRun = {
      id: runId,
      jobId,
      steps,
      currentStepIndex: 0,
      status: "idle",
    };

    this.activeRuns[runId] = run;
    console.log(`[WorkflowEngine] Created workflow run ${runId} for ${companyName} job ID ${jobId}`);
    return run;
  }

  public getRun(runId: string): WorkflowRun | null {
    return this.activeRuns[runId] || null;
  }

  public async startRun(runId: string, onStepChange: (run: WorkflowRun) => void): Promise<void> {
    const run = this.activeRuns[runId];
    if (!run || run.status === "running") return;

    run.status = "running";
    eventBus.publish("document.updated", { jobId: run.jobId, type: "workflow_started" });

    while (run.currentStepIndex < run.steps.length) {
      const idx = run.currentStepIndex;
      const step = run.steps[idx];
      step.status = "running";
      onStepChange({ ...run });

      try {
        await this.executeStep(step);
        step.status = "completed";
        run.currentStepIndex += 1;
        onStepChange({ ...run });
      } catch (err) {
        step.status = "failed";
        step.error = err instanceof Error ? err.message : "Step failed";
        run.status = "failed";
        onStepChange({ ...run });
        eventBus.publish("analytics.refreshed", { error: step.error });
        return;
      }

      // If step is user approval, pause execution until approved
      if (step.id === "user_approve" && run.currentStepIndex < run.steps.length) {
        run.status = "idle";
        onStepChange({ ...run });
        return; // Awaits user clicking "Approve and Submit"
      }
    }

    run.status = "completed";
    onStepChange({ ...run });
    eventBus.publish("job.applied", { jobId: run.jobId });
  }

  public async resumeAfterApproval(runId: string, onStepChange: (run: WorkflowRun) => void): Promise<void> {
    const run = this.activeRuns[runId];
    if (!run || run.steps[run.currentStepIndex - 1]?.id !== "user_approve") return;

    console.log(`[WorkflowEngine] Resuming workflow run ${runId} after user approval`);
    run.status = "running";
    this.startRun(runId, onStepChange);
  }

  private async executeStep(step: WorkflowStep): Promise<void> {
    return new Promise((resolve, reject) => {
      const duration = step.id === "browser_apply" ? 3000 : 1000;
      setTimeout(() => {
        if (Math.random() < 0.02) {
          reject(new Error("Network timeout during agent synchronization"));
        } else {
          resolve();
        }
      }, duration);
    });
  }
}

export const workflowEngine = new WorkflowEngine();
