/* ============================================================================
 * Vacatina Interaction Telemetry Logger
 * Lightweight in-memory interaction log for automated verification & debugging.
 * ============================================================================ */

export interface TelemetryEvent {
  event: string;
  payload: Record<string, unknown>;
  timestampIso: string;
}

class TelemetryService {
  private events: TelemetryEvent[] = [];

  public track(event: string, payload: Record<string, unknown> = {}): void {
    this.events.push({
      event,
      payload,
      timestampIso: new Date().toISOString()
    });
    if (this.events.length > 200) {
      this.events.shift();
    }
  }

  public getEvents(): TelemetryEvent[] {
    return [...this.events];
  }
}

export const telemetry = new TelemetryService();
