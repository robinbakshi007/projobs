// controllers/AnalyticsController.ts
import { platformKernel } from "../core/PlatformKernel";
import type { AnalyticsSummary } from "../services/AnalyticsService";

export class AnalyticsController {
  private service: any;

  constructor() {
    this.service = platformKernel.getService("AnalyticsService");
  }

  public getSummaryMetrics(): AnalyticsSummary {
    return this.service.getSummaryMetrics();
  }
}

export const analyticsController = new AnalyticsController();
