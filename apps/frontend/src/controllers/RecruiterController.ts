// controllers/RecruiterController.ts
import { platformKernel } from "../core/PlatformKernel";
import type { RecruiterContact, Interaction } from "../services/RecruiterService";

export class RecruiterController {
  private service: any;

  constructor() {
    this.service = platformKernel.getService("RecruiterService");
  }

  public getContacts(): RecruiterContact[] {
    return this.service.getContacts();
  }

  public getContactById(id: string): RecruiterContact | null {
    return this.service.getContactById(id);
  }

  public saveContact(contact: RecruiterContact): void {
    this.service.saveContact(contact);
  }

  public deleteContact(id: string): void {
    this.service.deleteContact(id);
  }

  public addInteraction(contactId: string, interaction: Omit<Interaction, "id" | "date">): void {
    this.service.addInteraction(contactId, interaction);
  }

  public getOutreachTemplate(contact: RecruiterContact, jobTitle: string): string {
    return this.service.getOutreachTemplate(contact, jobTitle);
  }
}

export const recruiterController = new RecruiterController();
