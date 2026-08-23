import { DemoAnalyticsService } from './analyticsService';
import { DemoAppService } from './demoService';

// Le mode de cette branche est volontairement figé : aucune sélection distante,
// aucune variable secrète et aucun repli silencieux vers un backend réel.
export const appDataService = new DemoAppService();
export const analyticsService = new DemoAnalyticsService();
