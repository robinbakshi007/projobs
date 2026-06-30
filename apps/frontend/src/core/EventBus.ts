// core/EventBus.ts

export type EventType =
  | "job.imported"
  | "job.selected"
  | "job.matched"
  | "job.tailored"
  | "job.applied"
  | "job.review_ready"
  | "job.rejected"
  | "recruiter.contacted"
  | "interview.created"
  | "offer.received"
  | "email.triaged"
  | "calendar.updated"
  | "automation.started"
  | "automation.completed"
  | "automation.failed"
  | "ai.completed"
  | "document.updated"
  | "analytics.refreshed";

type EventCallback = (payload: any) => void;

class EventBus {
  private listeners: Record<string, EventCallback[]> = {};

  public subscribe(event: EventType, callback: EventCallback): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    // Return unsubscribe function
    return () => {
      this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
    };
  }

  public publish(event: EventType, payload?: any): void {
    console.log(`[EventBus] Publishing ${event} with payload:`, payload);
    const callbacks = this.listeners[event] || [];
    callbacks.forEach((cb) => {
      try {
        cb(payload);
      } catch (err) {
        console.error(`Error in event listener for ${event}:`, err);
      }
    });
  }
}

export const eventBus = new EventBus();
