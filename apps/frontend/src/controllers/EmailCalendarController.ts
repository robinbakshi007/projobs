// controllers/EmailCalendarController.ts
import { platformKernel } from "../core/PlatformKernel";
import type { TriagedEmail, CalendarEvent } from "../services/EmailCalendarService";

export class EmailCalendarController {
  private service: any;

  constructor() {
    this.service = platformKernel.getService("EmailCalendarService");
  }

  public getEmails(): TriagedEmail[] {
    return this.service.getEmails();
  }

  public getEvents(): CalendarEvent[] {
    return this.service.getEvents();
  }

  public triageIncomingEmail(email: Omit<TriagedEmail, "id" | "receivedAt">): void {
    this.service.triageIncomingEmail(email);
  }
}

export const emailCalendarController = new EmailCalendarController();
