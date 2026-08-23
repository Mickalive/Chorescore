export type AnalyticsEvent = {
  name: 'task_completed' | 'feature_opened' | 'plan_previewed';
  occurredAt: string;
};

export interface AnalyticsService {
  setConsent(enabled: boolean): void;
  track(event: AnalyticsEvent): void;
  getInMemoryEventCount(): number;
}

export class DemoAnalyticsService implements AnalyticsService {
  private consent = false;
  private events: AnalyticsEvent[] = [];

  setConsent(enabled: boolean): void {
    this.consent = enabled;
    if (!enabled) {
      this.events = [];
    }
  }

  track(event: AnalyticsEvent): void {
    if (this.consent) {
      this.events.push({ ...event });
    }
  }

  getInMemoryEventCount(): number {
    return this.events.length;
  }
}

export class ProductionAnalyticsService implements AnalyticsService {
  setConsent(_enabled: boolean): void {
    throw new Error('Les analytics de production sont désactivés dans cette démo.');
  }

  track(_event: AnalyticsEvent): void {
    throw new Error('Les analytics de production sont désactivés dans cette démo.');
  }

  getInMemoryEventCount(): number {
    return 0;
  }
}
