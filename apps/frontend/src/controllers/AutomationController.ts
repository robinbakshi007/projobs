// controllers/AutomationController.ts
import { platformKernel } from "../core/PlatformKernel";
import type { AutomationDriver, SecurityVaultConfig } from "../services/AutomationService";

export class AutomationController {
  private service: any;

  constructor() {
    this.service = platformKernel.getService("AutomationService");
  }

  public getDrivers(): AutomationDriver[] {
    return this.service.getDrivers();
  }

  public getDriverById(id: string): AutomationDriver | null {
    return this.service.getDriverById(id);
  }

  public async executeAutomation(
    driverId: string,
    jobUrl: string,
    cvContent: string,
    vaultConfig: SecurityVaultConfig,
    onProgress: (progress: number, logLine: string) => void
  ): Promise<boolean> {
    return this.service.executeAutomation(driverId, jobUrl, cvContent, vaultConfig, onProgress);
  }
}

export const automationController = new AutomationController();
