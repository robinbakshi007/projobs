// services/AnalyticsService.ts
import { platformKernel } from "../core/PlatformKernel";

export interface AnalyticsSummary {
  totalApplications: number;
  totalInterviews: number;
  totalOffers: number;
  avgAtsScore: number;
  responseRate: number;
  salaryPipeline: string;
  funnel: {
    discovered: number;
    analysed: number;
    tailored: number;
    applied: number;
    interviewing: number;
    offers: number;
  };
  skillsGap: {
    strong: string[];
    weak: string[];
  };
}

class AnalyticsService {
  public getSummaryMetrics(): AnalyticsSummary {
    return {
      totalApplications: 38,
      totalInterviews: 7,
      totalOffers: 1,
      avgAtsScore: 84,
      responseRate: 18.4,
      salaryPipeline: "$145K",
      funnel: {
        discovered: 120,
        analysed: 85,
        tailored: 60,
        applied: 38,
        interviewing: 7,
        offers: 1,
      },
      skillsGap: {
        strong: ["React", "TypeScript", "JavaScript", "HTML5/CSS3", "Design Systems"],
        weak: ["Docker Containerization", "AWS deployments", "CI/CD pipeline builds", "Salesforce CRM APIs"],
      },
    };
  }
}

export const analyticsService = new AnalyticsService();
platformKernel.registerService("AnalyticsService", analyticsService);
