// controllers/AIController.ts
import { platformKernel } from "../core/PlatformKernel";
import type { AIAgent, PromptTemplate, InterviewSession, InterviewQuestion } from "../services/AIService";

export class AIController {
  private service: any;

  constructor() {
    this.service = platformKernel.getService("AIService");
  }

  public getAgents(): AIAgent[] {
    return this.service.getAgents();
  }

  public getAgentById(id: string): AIAgent | null {
    return this.service.getAgentById(id);
  }

  public getPrompts(): PromptTemplate[] {
    return this.service.getPrompts();
  }

  public async queryAgent(agentId: string, userText: string): Promise<string> {
    return this.service.queryAgent(agentId, userText);
  }

  public async getInterviewHistory(): Promise<InterviewSession[]> {
    return this.service.getInterviewHistory();
  }

  public async startInterviewSession(roleTitle: string, level: string, mode: string): Promise<{ session: InterviewSession; questions: InterviewQuestion[] }> {
    return this.service.startInterviewSession(roleTitle, level, mode);
  }

  public async submitInterviewResponse(questionId: number, transcript: string): Promise<{ response: any; sessionProgress: { answered: number; avg_score: number } }> {
    return this.service.submitInterviewResponse(questionId, transcript);
  }

  public async endInterviewSession(sessionId: number): Promise<void> {
    return this.service.endInterviewSession(sessionId);
  }
}

export const aiController = new AIController();
