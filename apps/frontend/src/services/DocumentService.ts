// services/DocumentService.ts
import { platformKernel } from "../core/PlatformKernel";
import { eventBus } from "../core/EventBus";

export interface DocumentRecord {
  id: string;
  name: string;
  type: "cv" | "cover_letter" | "certification" | "project" | "reference";
  content: string;
  tags: string[];
  updatedAt: string;
}

class DocumentService {
  private documents: DocumentRecord[] = [];
  private masterCvId = "doc-master-cv";

  constructor() {
    this.initializeMockLibrary();
  }

  public getDocuments(): DocumentRecord[] {
    return this.documents;
  }

  public getDocumentById(id: string): DocumentRecord | null {
    return this.documents.find((d) => d.id === id) || null;
  }

  public saveDocument(doc: DocumentRecord): void {
    const idx = this.documents.findIndex((d) => d.id === doc.id);
    if (idx >= 0) {
      this.documents[idx] = doc;
    } else {
      this.documents.push(doc);
    }
    eventBus.publish("document.updated", doc);
  }

  // RAG / Vector Search Mock Simulation
  public retrieveMatchingChunks(jobQuery: string): Array<{ score: number; docName: string; text: string }> {
    const query = jobQuery.toLowerCase();
    const matches: Array<{ score: number; docName: string; text: string }> = [];

    // Search through document chunks via keywords to simulate embedding search
    this.documents.forEach((doc) => {
      let score = 0.1;
      doc.tags.forEach((tag) => {
        if (query.includes(tag.toLowerCase())) {
          score += 0.25;
        }
      });

      if (score > 0.15) {
        matches.push({
          score: Math.min(score, 0.98),
          docName: doc.name,
          text: doc.content.slice(0, 150) + "...",
        });
      }
    });

    return matches.sort((a, b) => b.score - a.score);
  }

  private initializeMockLibrary() {
    this.documents = [
      {
        id: this.masterCvId,
        name: "Master CV 2026",
        type: "cv",
        content: "JOHN DOE\nStaff Frontend Engineer\nSkills: React, TypeScript, Redux, Node.js, HTML5, CSS3, Playwright, AWS.\n\nSummary:\nDynamic frontend software engineer with 8+ years experience architecting scalable user interfaces and design systems. Led visual console restructures that improved user retention by 28%. Expert in micro-frontend architectures, headless CMS integrations, and end-to-end browser test suites.",
        tags: ["React", "TypeScript", "Frontend", "Playwright", "AWS", "Design Systems"],
        updatedAt: new Date().toISOString(),
      },
      {
        id: "doc-project-ats",
        name: "Project: ATS Scanner",
        type: "project",
        content: "Built a React-based ATS resume scanner comparing file buffers against job descriptions, using cosine similarity embeddings. Provided PDF streams rendering overlay and layout locking modules.",
        tags: ["React", "ATS", "PDF", "Embeddings", "Visuals"],
        updatedAt: new Date().toISOString(),
      },
      {
        id: "doc-cert-aws",
        name: "Certification: AWS SysOps",
        type: "certification",
        content: "Amazon Web Services Certified SysOps Administrator Associate. Credentials verify cloud deployments, IAM access controls, routing pipelines, and resource monitoring.",
        tags: ["AWS", "Cloud", "Deployments", "Security"],
        updatedAt: new Date().toISOString(),
      },
      {
        id: "doc-letter-generic",
        name: "Cover Letter: Generic",
        type: "cover_letter",
        content: "Dear Hiring Manager,\n\nI am writing to express my enthusiastic interest in your open position. With a strong track record building high-performance frontend interfaces and leading engineering teams, I am confident in my fit. Thank you for your time.",
        tags: ["Cover Letter", "Intro"],
        updatedAt: new Date().toISOString(),
      },
    ];
  }
}

export const documentService = new DocumentService();
platformKernel.registerService("DocumentService", documentService);
