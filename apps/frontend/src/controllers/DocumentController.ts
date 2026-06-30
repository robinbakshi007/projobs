// controllers/DocumentController.ts
import { platformKernel } from "../core/PlatformKernel";
import type { DocumentRecord } from "../services/DocumentService";

export class DocumentController {
  private service: any;

  constructor() {
    this.service = platformKernel.getService("DocumentService");
  }

  public getDocuments(): DocumentRecord[] {
    return this.service.getDocuments();
  }

  public getDocumentById(id: string): DocumentRecord | null {
    return this.service.getDocumentById(id);
  }

  public saveDocument(doc: DocumentRecord): void {
    this.service.saveDocument(doc);
  }

  public retrieveMatchingChunks(jobQuery: string): Array<{ score: number; docName: string; text: string }> {
    return this.service.retrieveMatchingChunks(jobQuery);
  }
}

export const documentController = new DocumentController();
