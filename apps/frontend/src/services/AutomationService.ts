// services/AutomationService.ts
import { platformKernel } from "../core/PlatformKernel";
import { eventBus } from "../core/EventBus";

export interface AutomationDriver {
  id: string;
  name: string;
  capabilities: {
    easyApply: boolean;
    customQuestions: boolean;
    captchaBypass: boolean;
    cookieSync: boolean;
    vaultOAuth: boolean;
    isolatedContext: boolean;
  };
  status: "active" | "experimental" | "beta";
}

export interface SecurityVaultConfig {
  isolatedSession: boolean;
  proxyRouting: boolean;
  encryptedSecrets: boolean;
  auditTrailEnabled: boolean;
}

class AutomationService {
  private drivers: Record<string, AutomationDriver> = {};
  private activeLogs: string[] = [];
  private runProgress = 0;

  constructor() {
    this.initializeDrivers();
  }

  public getDrivers(): AutomationDriver[] {
    return Object.values(this.drivers);
  }

  public getDriverById(id: string): AutomationDriver | null {
    return this.drivers[id] || null;
  }

  public getRunProgress(): number {
    return this.runProgress;
  }

  // Universal execution driver simulation. It stops at review-ready and does not submit externally.
  public async executeAutomation(
    driverId: string,
    jobUrl: string,
    cvContent: string,
    vaultConfig: SecurityVaultConfig,
    onProgress: (progress: number, logLine: string) => void
  ): Promise<boolean> {
    const driver = this.drivers[driverId];
    if (!driver) throw new Error(`Driver ${driverId} not registered.`);

    this.activeLogs = [];
    this.runProgress = 0;
    const cvLength = cvContent.trim().length;

    const logAndNotify = (line: string, pct: number) => {
      this.activeLogs.push(line);
      this.runProgress = pct;
      onProgress(pct, line);
    };

    return new Promise((resolve) => {
      logAndNotify(`[1/6] Initializing isolated Playwright browser context using ${driver.name} driver with ${cvLength} CV characters...`, 10);
      
      if (vaultConfig.isolatedSession) {
        setTimeout(() => logAndNotify(`[Zero-Trust] Created isolated browser container environment successfully.`, 20), 500);
      }

      setTimeout(() => {
        logAndNotify(`[2/6] Syncing credential tokens & vault cookies...`, 30);
      }, 1000);

      setTimeout(() => {
        logAndNotify(`[3/6] Navigating to job URL: ${jobUrl.slice(0, 40)}...`, 50);
      }, 2000);

      setTimeout(() => {
        logAndNotify(`[4/6] Parsing application form and filling standard fields...`, 70);
        if (driver.capabilities.easyApply) {
          logAndNotify(`[Driver Capability] Triggering Quick Apply script bindings.`, 75);
        }
      }, 3000);

      setTimeout(() => {
        logAndNotify(`[5/6] Tailoring CV payload buffer and attaching cover letter...`, 90);
      }, 4000);

      setTimeout(() => {
        logAndNotify(`[6/6] Review package ready. Final submission is paused for human approval.`, 100);
        eventBus.publish("job.review_ready", { driverId, jobUrl });
        resolve(true);
      }, 5000);
    });
  }

  private initializeDrivers() {
    const defaultDrivers: AutomationDriver[] = [
      {
        id: "seek",
        name: "SEEK Australia",
        capabilities: {
          easyApply: true,
          customQuestions: true,
          captchaBypass: false,
          cookieSync: true,
          vaultOAuth: false,
          isolatedContext: true,
        },
        status: "active",
      },
      {
        id: "linkedin",
        name: "LinkedIn EasyApply",
        capabilities: {
          easyApply: true,
          customQuestions: true,
          captchaBypass: false,
          cookieSync: true,
          vaultOAuth: true,
          isolatedContext: true,
        },
        status: "active",
      },
      {
        id: "workday",
        name: "Workday Portal",
        capabilities: {
          easyApply: false,
          customQuestions: true,
          captchaBypass: false,
          cookieSync: false,
          vaultOAuth: false,
          isolatedContext: true,
        },
        status: "beta",
      },
      {
        id: "greenhouse",
        name: "Greenhouse",
        capabilities: {
          easyApply: true,
          customQuestions: true,
          captchaBypass: false,
          cookieSync: false,
          vaultOAuth: false,
          isolatedContext: true,
        },
        status: "active",
      },
      {
        id: "lever",
        name: "Lever",
        capabilities: {
          easyApply: true,
          customQuestions: false,
          captchaBypass: false,
          cookieSync: false,
          vaultOAuth: false,
          isolatedContext: true,
        },
        status: "active",
      },
      {
        id: "successfactors",
        name: "SAP SuccessFactors",
        capabilities: {
          easyApply: false,
          customQuestions: true,
          captchaBypass: false,
          cookieSync: true,
          vaultOAuth: false,
          isolatedContext: true,
        },
        status: "experimental",
      },
    ];

    defaultDrivers.forEach((d) => {
      this.drivers[d.id] = d;
    });
  }
}

export const automationService = new AutomationService();
platformKernel.registerService("AutomationService", automationService);

