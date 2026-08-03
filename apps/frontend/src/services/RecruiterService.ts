// services/RecruiterService.ts
import { platformKernel } from "../core/PlatformKernel";
import { eventBus } from "../core/EventBus";

export interface Interaction {
  id: string;
  type: "call" | "email" | "linkedin" | "meeting";
  date: string;
  summary: string;
  notes?: string;
}

export interface RecruiterContact {
  id: string;
  name: string;
  company: string;
  email: string;
  status: "discovered" | "contacted" | "interviewing" | "offer" | "rejected";
  nextStep: string;
  followUpDate: string;
  notes: string;
  jobWorkspaceId?: number; // Linked workspace ID
  interactions: Interaction[];
}

class RecruiterService {
  private contacts: RecruiterContact[] = [];

  constructor() {
    this.initializeMockCRM();
  }

  public getContacts(): RecruiterContact[] {
    return this.contacts;
  }

  public getContactById(id: string): RecruiterContact | null {
    return this.contacts.find((c) => c.id === id) || null;
  }

  public saveContact(contact: RecruiterContact): void {
    const idx = this.contacts.findIndex((c) => c.id === contact.id);
    if (idx >= 0) {
      this.contacts[idx] = contact;
    } else {
      this.contacts.push(contact);
    }
    eventBus.publish("recruiter.contacted", contact);
  }

  public deleteContact(id: string): void {
    this.contacts = this.contacts.filter((c) => c.id !== id);
    eventBus.publish("analytics.refreshed", { deletedId: id });
  }

  public addInteraction(contactId: string, interaction: Omit<Interaction, "id" | "date">): void {
    const contact = this.getContactById(contactId);
    if (!contact) return;

    const newInteraction: Interaction = {
      ...interaction,
      id: `int-${Date.now()}`,
      date: new Date().toISOString().split("T")[0],
    };

    contact.interactions.push(newInteraction);
    eventBus.publish("recruiter.contacted", contact);
  }

  public getOutreachTemplate(contact: RecruiterContact, jobTitle: string): string {
    return `Subject: Outreach: ${jobTitle} application - ${contact.name}\n\nHi ${contact.name.split(" ")[0] || "there"},\n\nI recently applied for the ${jobTitle} position at ${contact.company}. I'm writing to share that I have extensive experience in React/TypeScript, and integrated dashboard visualizers at my previous roles.\n\nI would love to set up a short chat to walk you through my portfolio. Looking forward to your response!\n\nSincerely,\n[Your Name]`;
  }

  private initializeMockCRM() {
    this.contacts = [
      {
        id: "rec-1",
        name: "Chris McDonald",
        company: "Hydro Tasmania",
        email: "chris.mcdonald@hydro.com.au",
        status: "interviewing",
        nextStep: "Prepare for technical panel interview",
        followUpDate: "2026-06-26",
        notes: "Loves Salesforce experience. Emphasize API integration history.",
        jobWorkspaceId: 3,
        interactions: [
          {
            id: "int-1",
            type: "linkedin",
            date: "2026-06-23",
            summary: "Initial Outreach",
            notes: "Sent introductory message sharing CareerOS project architecture.",
          },
          {
            id: "int-2",
            type: "call",
            date: "2026-06-24",
            summary: "15 min Recruiter Screen",
            notes: "Discussed salary constraints, onsite expectations, and React systems.",
          },
        ],
      },
      {
        id: "rec-2",
        name: "Sarah Jenkins",
        company: "Atlassian",
        email: "sjenkins@atlassian.com",
        status: "discovered",
        nextStep: "Wait for recruiter screening call",
        followUpDate: "2026-06-29",
        notes: "Applied through automated Seek Playwright agent with Creative layout.",
        jobWorkspaceId: 1,
        interactions: [
          {
            id: "int-3",
            type: "email",
            date: "2026-06-24",
            summary: "Automation Confirmation",
            notes: "Received automatic email receipt acknowledging application submit.",
          },
        ],
      },
    ];
  }
}

export const recruiterService = new RecruiterService();
platformKernel.registerService("RecruiterService", recruiterService);
