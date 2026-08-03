// services/EmailCalendarService.ts
import { platformKernel } from "../core/PlatformKernel";
import { eventBus } from "../core/EventBus";

export interface TriagedEmail {
  id: string;
  sender: string;
  subject: string;
  body: string;
  category: "outreach" | "interview" | "offer" | "rejection" | "general";
  receivedAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  durationMinutes: number;
  jobId?: number;
  type: "interview" | "research" | "mock_prep" | "star_practice";
}

class EmailCalendarService {
  private emails: TriagedEmail[] = [];
  private events: CalendarEvent[] = [];

  constructor() {
    this.initializeMockData();
  }

  public getEmails(): TriagedEmail[] {
    return this.emails;
  }

  public getEvents(): CalendarEvent[] {
    return this.events;
  }

  public triageIncomingEmail(email: Omit<TriagedEmail, "id" | "receivedAt">): void {
    const newEmail: TriagedEmail = {
      ...email,
      id: `mail-${Date.now()}`,
      receivedAt: new Date().toLocaleTimeString(),
    };

    this.emails.push(newEmail);
    eventBus.publish("email.triaged", newEmail);

    // If it's an interview request, automatically schedule preparation blocks
    if (email.category === "interview") {
      this.autoSchedulePrepEvents(email.sender);
    }
  }

  private autoSchedulePrepEvents(sender: string) {
    const today = new Date().toISOString().split("T")[0];
    
    const newEvents: CalendarEvent[] = [
      {
        id: `cal-res-${Date.now()}`,
        title: `Research ${sender} Tech Stack & Culture`,
        start: `${today}T10:00:00`,
        durationMinutes: 60,
        type: "research",
      },
      {
        id: `cal-star-${Date.now()}`,
        title: `Structure STAR Questions Practice`,
        start: `${today}T13:00:00`,
        durationMinutes: 45,
        type: "star_practice",
      },
      {
        id: `cal-mock-${Date.now()}`,
        title: `Voice Mock Drill (Interview Buddy)`,
        start: `${today}T15:00:00`,
        durationMinutes: 30,
        type: "mock_prep",
      },
    ];

    this.events.push(...newEvents);
    eventBus.publish("calendar.updated", newEvents);
  }

  private initializeMockData() {
    const today = new Date().toISOString().split("T")[0];

    this.emails = [
      {
        id: "mail-1",
        sender: "Sarah Jenkins (Atlassian)",
        subject: "Interview Request: Staff Frontend Engineer",
        body: "Hi John, we reviewed your tailored CV and would love to schedule a panel loop. Let's arrange a 45-minute Google Meet next week.",
        category: "interview",
        receivedAt: "10:15 AM",
      },
      {
        id: "mail-2",
        sender: "Chris McDonald (Hydro Tasmania)",
        subject: "Technical assessment instructions",
        body: "Hi John, please complete this React visual grid assessment. Submissions must be zipped and include test logs.",
        category: "outreach",
        receivedAt: "Yesterday",
      },
      {
        id: "mail-3",
        sender: "Google Careers",
        subject: "Application update",
        body: "Thank you for your interest in the Systems role. Unfortunately, we are not moving forward at this time.",
        category: "rejection",
        receivedAt: "2 days ago",
      },
    ];

    this.events = [
      {
        id: "cal-1",
        title: "Atlassian Panel Loop",
        start: `${today}T11:00:00`,
        durationMinutes: 45,
        type: "interview",
      },
      {
        id: "cal-2",
        title: "Research Hydro Tasmania Systems",
        start: `${today}T09:00:00`,
        durationMinutes: 60,
        type: "research",
      },
    ];
  }
}

export const emailCalendarService = new EmailCalendarService();
platformKernel.registerService("EmailCalendarService", emailCalendarService);
