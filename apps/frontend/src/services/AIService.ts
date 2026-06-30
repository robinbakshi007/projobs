// services/AIService.ts
import { platformKernel } from "../core/PlatformKernel";
import { eventBus } from "../core/EventBus";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api/v1";

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("auth_token") ?? "";
  const tenantId = localStorage.getItem("tenant_id") ?? "";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
  };
}

export interface AIAgent {
  id: string;
  name: string;
  role: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  tools: string[];
  memory: string[];
  history: Array<{ role: "user" | "assistant"; text: string }>;
  confidenceScore: number;
}

export interface PromptTemplate {
  id: string;
  version: string;
  temperature: number;
  systemPrompt: string;
  owner: string;
}

export interface InterviewSession {
  id: number;
  role_title: string;
  level: string;
  mode: string;
  status: string;
  total_questions: number;
  answered_count: number;
  avg_score: number | null;
  started_at: string;
}

export interface InterviewQuestion {
  id: number;
  category: string;
  question_text: string;
  expected_focus: string;
  difficulty: number;
  response?: {
    transcript_text: string;
    ai_feedback: string;
    overall_score: number;
    scores_json: Record<string, number>;
  } | null;
}

class AIService {
  private agents: Record<string, AIAgent> = {};
  private promptTemplates: Record<string, PromptTemplate> = {};
  private interviewHistory: InterviewSession[] = [];
  private activeSession: InterviewSession | null = null;
  private activeQuestions: InterviewQuestion[] = [];

  constructor() {
    this.initializeAgents();
    this.initializePrompts();
  }

  public getAgents(): AIAgent[] {
    return Object.values(this.agents);
  }

  public getAgentById(id: string): AIAgent | null {
    return this.agents[id] || null;
  }

  public getPrompts(): PromptTemplate[] {
    return Object.values(this.promptTemplates);
  }

  // Orchestrate agentic query
  public async queryAgent(agentId: string, userText: string): Promise<string> {
    const agent = this.agents[agentId];
    if (!agent) throw new Error(`Agent ${agentId} not registered.`);

    agent.history.push({ role: "user", text: userText });
    eventBus.publish("ai.completed", { agentId, status: "thinking" });

    return new Promise((resolve) => {
      setTimeout(() => {
        let reply = "";
        
        switch (agentId) {
          case "cv_expert":
            reply = `[CV Expert] I reviewed your resume phrasing. Under "Staff Frontend Engineer", let's rewrite: "I helped build the wizard app" into: "Architected a multi-step dynamic onboarding wizard utilizing React-pdf and custom state pipelines, resulting in a 34% drop in application dropout rate."`;
            break;
          case "ats_expert":
            reply = `[ATS Expert] Your compatibility score for Atlassian is 92%. I recommend adding these exact keywords: "Salesforce Cloud", "Docker Containers", and "CI/CD Pipelines" to bypass the automated screening filters.`;
            break;
          case "salary_advisor":
            reply = `[Salary Advisor] Based on Atlassian's Staff Frontend Engineer benchmark, the salary range is $160K - $180K + Super. Your target should be $172K plus equity options. Leverage your specialized Salesforce visual system skillset in negotiation.`;
            break;
          case "interview_coach":
            reply = `[Interview Coach] Let's rehearse the STAR technique. For Atlassian, expect: "Tell me about a time you optimized a slow React dashboard." Let's structure the answer: Situation: 2000 table nodes lagging; Task: Improve response; Action: Memogrid + virtualized rows; Result: Render lag decreased by 75%.`;
            break;
          case "recruiter_assistant":
            reply = `[Recruiter Assistant] Here is a custom Outreach Email template:\n\n"Hi Sarah,\n\nI just applied for the Staff Frontend role. Given my background building React visual consoles at Hydro Tasmania, I am excited about Atlassian's UX pipeline. I look forward to discussing the role.\n\nBest,\n[Your Name]"`;
            break;
          case "negotiation_coach":
            reply = `[Negotiation Coach] When reviewing the Atlassian offer, express enthusiasm but ask: "Are there flexible bounds around the equity vesting schedule or base salary bands to align with my Salesforce specialized certifications?"`;
            break;
          case "career_planner":
            reply = `[Career Planner] Target milestones: Week 1: Apply to Atlassian & Canva; Week 2: Recruiter screening loops; Week 3: STAR Mock drill sessions; Week 4: Final rounds and salary negotiations.`;
            break;
          default:
            reply = `[${agent.name}] I am here to help you coordinate your career goals. Let's look at what details we can optimize.`;
        }

        agent.history.push({ role: "assistant", text: reply });
        agent.memory.push(`User query: "${userText.slice(0, 40)}..." -> Reply logged.`);
        eventBus.publish("ai.completed", { agentId, status: "idle", reply });
        resolve(reply);
      }, 1200);
    });
  }

  private initializeAgents() {
    const defaultAgents: AIAgent[] = [
      {
        id: "cv_expert",
        name: "CV Expert",
        role: "Resume phrasing and layout optimization specialist",
        systemPrompt: "You are a professional resume writer. Rewrite passive descriptions into impactful achievements.",
        model: "gemini-2.0-pro-exp",
        temperature: 0.2,
        tools: ["cv_rewrite", "quantify_impact", "grammar_check"],
        memory: ["Optimized CV structure for user master document."],
        history: [],
        confidenceScore: 0.98,
      },
      {
        id: "ats_expert",
        name: "ATS Expert",
        role: "Applicant Tracking Systems scanner and parser advisor",
        systemPrompt: "You are an ATS advisor. Check resumes against compatibility filters for Workday, Taleo, and Greenhouse.",
        model: "gemini-2.0-flash",
        temperature: 0.1,
        tools: ["keyword_scan", "format_audit", "compatibility_test"],
        memory: ["Audited Workday compatibility checklist."],
        history: [],
        confidenceScore: 0.95,
      },
      {
        id: "salary_advisor",
        name: "Salary Advisor",
        role: "Market benchmarking and salary advisor",
        systemPrompt: "You are a recruitment compensation analyst. Provide salary bands and equity structure guides.",
        model: "gemini-2.0-flash",
        temperature: 0.4,
        tools: ["benchmark_lookup", "equity_calculator"],
        memory: ["Linked market benchmark for Sydney frontend engineers."],
        history: [],
        confidenceScore: 0.92,
      },
      {
        id: "interview_coach",
        name: "Interview Coach",
        role: "Mock loops trainer and STAR structured response coach",
        systemPrompt: "You are an interview coach. Grade candidate responses based on STAR format structure.",
        model: "gemini-2.0-pro-exp",
        temperature: 0.5,
        tools: ["verbal_grading", "star_scaffold", "speech_synth"],
        memory: ["Conducted mock simulation for Hydro Tasmania."],
        history: [],
        confidenceScore: 0.94,
      },
      {
        id: "recruiter_assistant",
        name: "Recruiter Assistant",
        role: "Recruiter relations and email automation planner",
        systemPrompt: "You are a professional networker. Help candidates draft cold outreach emails and schedule follow-ups.",
        model: "gemini-2.0-flash",
        temperature: 0.3,
        tools: ["outreach_builder", "follow_up_timer"],
        memory: ["Generated Hydro Tasmania follow-up reminder."],
        history: [],
        confidenceScore: 0.90,
      },
      {
        id: "negotiation_coach",
        name: "Negotiation Coach",
        role: "Compensation negotiation specialist",
        systemPrompt: "You are a professional negotiation strategist. Guide user through offer letters evaluation.",
        model: "gemini-2.0-pro-exp",
        temperature: 0.5,
        tools: ["offer_audit", "rebuttal_generator"],
        memory: [],
        history: [],
        confidenceScore: 0.96,
      },
      {
        id: "career_planner",
        name: "Career Planner",
        role: "Timeline and progression milestone strategist",
        systemPrompt: "You are a career consultant. Plan milestones and outline skills gaps.",
        model: "gemini-2.0-flash",
        temperature: 0.4,
        tools: ["milestone_forecast", "skills_gap_map"],
        memory: [],
        history: [],
        confidenceScore: 0.91,
      },
    ];

    defaultAgents.forEach((a) => {
      this.agents[a.id] = a;
    });
  }

  private initializePrompts() {
    this.promptTemplates = {
      "cv_optimize_v1": {
        id: "cv_optimize_v1",
        version: "1.0.0",
        temperature: 0.2,
        systemPrompt: "You are an expert recruiter. Rewrite CV content to emphasize tech achievements.",
        owner: "AI Team",
      },
      "ats_keyword_v1": {
        id: "ats_keyword_v1",
        version: "1.0.1",
        temperature: 0.1,
        systemPrompt: "Identify missing keywords in the resume that exist in the job description.",
        owner: "ATS Team",
      },
    };
  }

  public async getInterviewHistory(): Promise<InterviewSession[]> {
    try {
      const response = await fetch(`${API}/interview/history`, {
        headers: authHeaders(),
      });
      if (response.ok) {
        const body = await response.json();
        this.interviewHistory = body.data ?? [];
        return this.interviewHistory;
      }
    } catch (err) {
      console.warn("Backend offline or request failed, falling back to mock history.", err);
    }

    if (this.interviewHistory.length === 0) {
      this.interviewHistory = [
        {
          id: 101,
          role_title: "Senior React Developer",
          level: "senior",
          mode: "mock",
          status: "completed",
          total_questions: 3,
          answered_count: 3,
          avg_score: 87,
          started_at: new Date().toISOString()
        }
      ];
    }
    return this.interviewHistory;
  }

  public async startInterviewSession(roleTitle: string, level: string, mode: string): Promise<{ session: InterviewSession; questions: InterviewQuestion[] }> {
    try {
      const response = await fetch(`${API}/interview/sessions`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ role_title: roleTitle, level, mode }),
      });
      if (response.ok) {
        const body = await response.json();
        this.activeSession = body.data;
        this.activeQuestions = body.data.questions ?? [];
        // Reload history in background
        this.getInterviewHistory();
        return { session: this.activeSession!, questions: this.activeQuestions };
      }
    } catch (err) {
      console.warn("Backend offline or start failed, loading sandbox mock session.", err);
    }

    this.activeSession = {
      id: Date.now(),
      role_title: roleTitle,
      level,
      mode,
      status: "active",
      total_questions: 3,
      answered_count: 0,
      avg_score: null,
      started_at: new Date().toISOString()
    };

    this.activeQuestions = [
      {
        id: 1,
        category: "Technical",
        question_text: `Tell me about your experience as a ${roleTitle} and how you approach building scalable codebases.`,
        expected_focus: "React architectures, design systems, hooks, lifecycle management",
        difficulty: 3
      },
      {
        id: 2,
        category: "Behavioral",
        question_text: "Describe a situation where you had a disagreement with a product manager or tech lead. How did you resolve it?",
        expected_focus: "Communication, active listening, negotiation, alignment",
        difficulty: 4
      },
      {
        id: 3,
        category: "System Design",
        question_text: `How would you design a real-time tracking console like the Salesforce Lightning dashboard?`,
        expected_focus: "Websockets, React performance, state synchronization, caching layers",
        difficulty: 5
      }
    ];

    return { session: this.activeSession, questions: this.activeQuestions };
  }

  public async submitInterviewResponse(questionId: number, transcript: string): Promise<{ response: any; sessionProgress: { answered: number; avg_score: number } }> {
    try {
      const response = await fetch(
        `${API}/interview/questions/${questionId}/respond`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ transcript_text: transcript }),
        }
      );
      if (response.ok) {
        const body = await response.json();
        const feedback = body.data;
        this.activeQuestions = this.activeQuestions.map((q) =>
          q.id === questionId ? { ...q, response: feedback } : q
        );
        if (this.activeSession) {
          this.activeSession.answered_count = body.session_progress.answered;
          this.activeSession.avg_score = body.session_progress.avg_score;
        }
        return {
          response: feedback,
          sessionProgress: {
            answered: body.session_progress.answered,
            avg_score: body.session_progress.avg_score
          }
        };
      }
    } catch (err) {
      console.warn("Backend offline or submit failed, simulating sandbox feedback.", err);
    }

    const mockScore = Math.floor(Math.random() * 25) + 70; // 70-95
    const mockFeedback = {
      transcript_text: transcript,
      ai_feedback: `Excellent answer! You structured your points logically. You successfully addressed keywords such as 'React' and 'Component lifecycle'. To improve, consider adding more concrete metrics of past performance.`,
      overall_score: mockScore,
      scores_json: {
        "Clarity & Structure": Math.floor(Math.random() * 3) + 7, // 7-9
        "Technical Depth": Math.floor(Math.random() * 3) + 7,
        "Communication Skills": Math.floor(Math.random() * 3) + 8
      }
    };

    this.activeQuestions = this.activeQuestions.map((q) =>
      q.id === questionId ? { ...q, response: mockFeedback } : q
    );

    if (this.activeSession) {
      const nextAnswered = this.activeSession.answered_count + 1;
      const nextAvg = this.activeSession.avg_score 
        ? Math.round((this.activeSession.avg_score * this.activeSession.answered_count + mockScore) / nextAnswered)
        : mockScore;
      this.activeSession.answered_count = nextAnswered;
      this.activeSession.avg_score = nextAvg;
    }

    return {
      response: mockFeedback,
      sessionProgress: {
        answered: this.activeSession?.answered_count || 0,
        avg_score: this.activeSession?.avg_score || 0
      }
    };
  }

  public async endInterviewSession(sessionId: number): Promise<void> {
    try {
      await fetch(`${API}/interview/sessions/${sessionId}/end`, {
        method: "POST",
        headers: authHeaders(),
      });
    } catch (err) {
      console.warn("Backend offline or end failed, exiting locally.", err);
    }

    if (this.activeSession && this.activeSession.id === sessionId) {
      this.activeSession.status = "completed";
      this.interviewHistory = [this.activeSession, ...this.interviewHistory.filter((s) => s.id !== sessionId)];
    }
    this.activeSession = null;
    this.activeQuestions = [];
    // Reload history
    await this.getInterviewHistory();
  }
}

export const aiService = new AIService();
platformKernel.registerService("AIService", aiService);
