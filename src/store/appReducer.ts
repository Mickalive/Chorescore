import { getEffectiveWeight, getEntitlements } from '../domain/entitlements';
import type {
  AppSnapshot,
  ConsentState,
  PlanScenario,
  PremiumFeature,
  TaskCategory,
  TaskDefinition,
  TaskEntry,
} from '../domain/types';
import { validateManualMinutes, validateTaskInput } from '../domain/validation';

export type HydrationPhase =
  | { phase: 'loading' }
  | { phase: 'ready' }
  | { phase: 'error'; message: string };

export type AppState = AppSnapshot & {
  hydration: HydrationPhase;
  onboardingComplete: boolean;
  consent: ConsentState;
  paywallFeature: PremiumFeature | null;
  notice: string | null;
  analyticsEventCount: number;
};

export type Action =
  | {
      type: 'HYDRATION_READY';
      snapshot: AppSnapshot;
      durable: { onboardingComplete: boolean; consent: ConsentState };
      notice: string | null;
    }
  | { type: 'HYDRATION_FAILED'; message: string }
  | { type: 'HYDRATION_RESTART' }
  | { type: 'COMPLETE_ONBOARDING'; consent: ConsentState }
  | { type: 'SET_ANALYTICS_CONSENT'; enabled: boolean; eventCount: number }
  | { type: 'SET_PLAN'; plan: PlanScenario; maxMembers: number | null }
  | { type: 'SET_USER'; userId: string }
  | { type: 'ADD_TASK'; task: TaskDefinition }
  | { type: 'ADD_ENTRY'; entry: TaskEntry; eventCount: number }
  | { type: 'REPLACE_ENTRY'; entry: TaskEntry; eventCount: number }
  | { type: 'SHOW_PAYWALL'; feature: PremiumFeature }
  | { type: 'HIDE_PAYWALL' }
  | { type: 'SET_NOTICE'; notice: string | null }
  | { type: 'RESET_DEMO'; snapshot: AppSnapshot };

export const TERMS_VERSION = 'demo-v1';

const EPOCH_ISO = '1970-01-01T00:00:00.000Z';

/**
 * État d'amorçage utilisé pendant l'hydratation : volontairement vide, il ne
 * contient aucune donnée fictive de démonstration afin qu'aucun écran ne puisse
 * afficher un flash de `demoData` avant la lecture du stockage.
 */
export function createLoadingState(): AppState {
  return {
    users: [],
    household: {
      id: '',
      name: '',
      timezone: 'UTC',
      plan: 'trial',
      trialStartedAt: EPOCH_ISO,
      trialEndsAt: EPOCH_ISO,
      maxMembers: null,
    },
    memberships: [],
    tasks: [],
    entries: [],
    currentUserId: '',
    hydration: { phase: 'loading' },
    onboardingComplete: false,
    consent: {
      termsAccepted: false,
      termsVersion: TERMS_VERSION,
      acceptedAt: null,
      analyticsOptIn: false,
    },
    paywallFeature: null,
    notice: null,
    analyticsEventCount: 0,
  };
}

export function createInitialState(snapshot: AppSnapshot): AppState {
  return {
    ...snapshot,
    hydration: { phase: 'ready' },
    onboardingComplete: false,
    consent: {
      termsAccepted: false,
      termsVersion: TERMS_VERSION,
      acceptedAt: null,
      analyticsOptIn: false,
    },
    paywallFeature: null,
    notice: null,
    analyticsEventCount: 0,
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'HYDRATION_READY':
      return {
        ...action.snapshot,
        hydration: { phase: 'ready' },
        onboardingComplete: action.durable.onboardingComplete,
        consent: action.durable.consent,
        paywallFeature: null,
        notice: action.notice,
        analyticsEventCount: 0,
      };
    case 'HYDRATION_FAILED':
      return { ...createLoadingState(), hydration: { phase: 'error', message: action.message } };
    case 'HYDRATION_RESTART':
      return createLoadingState();
    case 'COMPLETE_ONBOARDING':
      return { ...state, onboardingComplete: true, consent: action.consent, notice: null };
    case 'SET_ANALYTICS_CONSENT':
      return {
        ...state,
        consent: { ...state.consent, analyticsOptIn: action.enabled },
        analyticsEventCount: action.eventCount,
      };
    case 'SET_PLAN':
      return {
        ...state,
        household: { ...state.household, plan: action.plan, maxMembers: action.maxMembers },
        notice: `Scénario ${action.plan} activé pour tout le foyer.`,
      };
    case 'SET_USER':
      return { ...state, currentUserId: action.userId, notice: null };
    case 'ADD_TASK':
      return { ...state, tasks: [action.task, ...state.tasks], notice: 'La tâche a été ajoutée.' };
    case 'ADD_ENTRY':
      return {
        ...state,
        entries: [action.entry, ...state.entries],
        notice: action.entry.status === 'in_progress' ? 'Chrono démarré.' : 'Temps ajouté.',
        analyticsEventCount: action.eventCount,
      };
    case 'REPLACE_ENTRY':
      return {
        ...state,
        entries: state.entries.map((entry) => (entry.id === action.entry.id ? action.entry : entry)),
        notice: 'Tâche terminée et score mis à jour.',
        analyticsEventCount: action.eventCount,
      };
    case 'SHOW_PAYWALL':
      return { ...state, paywallFeature: action.feature };
    case 'HIDE_PAYWALL':
      return { ...state, paywallFeature: null };
    case 'SET_NOTICE':
      return { ...state, notice: action.notice };
    case 'RESET_DEMO':
      return {
        ...state,
        ...action.snapshot,
        paywallFeature: null,
        notice: 'Les données fictives ont été réinitialisées.',
      };
  }
}

export type InteractionPlan<T> = { ok: true; value: T } | { ok: false; error: string };

export type AddTaskFormInput = {
  name: string;
  category: TaskCategory;
  weight: number;
};

export type PlannedTaskCreation = {
  name: string;
  category: TaskCategory;
  weight: number;
};

export function planAddTask(state: AppState, input: AddTaskFormInput): InteractionPlan<PlannedTaskCreation> {
  const error = validateTaskInput(input);
  if (error !== null) {
    return { ok: false, error };
  }
  const entitlements = getEntitlements(state.household.plan);
  return {
    ok: true,
    value: {
      name: input.name,
      category: input.category,
      weight: entitlements.canCustomizeWeights ? input.weight : 1,
    },
  };
}

export type PlannedTimerStart = {
  task: TaskDefinition;
  effectiveWeight: number;
};

export function planStartTimer(state: AppState, taskId: string): InteractionPlan<PlannedTimerStart> {
  const task = state.tasks.find((candidate) => candidate.id === taskId);
  if (task === undefined) {
    return { ok: false, error: 'Cette tâche n’existe plus.' };
  }
  const alreadyRunning = state.entries.some(
    (entry) => entry.userId === state.currentUserId && entry.status === 'in_progress',
  );
  if (alreadyRunning) {
    return { ok: false, error: 'Termine le chrono actif avant d’en lancer un autre.' };
  }
  return {
    ok: true,
    value: {
      task,
      effectiveWeight: getEffectiveWeight(state.household.plan, task.weight),
    },
  };
}

export function planCompleteTimer(state: AppState, entryId: string): InteractionPlan<{ entry: TaskEntry }> {
  const entry = state.entries.find(
    (candidate) => candidate.id === entryId && candidate.userId === state.currentUserId,
  );
  if (entry === undefined || entry.status !== 'in_progress') {
    return { ok: false, error: 'Ce chrono n’est pas disponible.' };
  }
  return { ok: true, value: { entry } };
}

export function planSetUser(state: AppState, userId: string): InteractionPlan<string> {
  if (!state.users.some((user) => user.id === userId)) {
    return { ok: false, error: 'Ce membre est introuvable dans ce foyer.' };
  }
  return { ok: true, value: userId };
}

export type PlannedManualEntry = {
  task: TaskDefinition;
  durationMinutes: number;
  effectiveWeight: number;
};

export function planManualEntry(
  state: AppState,
  taskId: string,
  durationMinutes: number,
): InteractionPlan<PlannedManualEntry> {
  const error = validateManualMinutes(durationMinutes);
  if (error !== null) {
    return { ok: false, error };
  }
  const task = state.tasks.find((candidate) => candidate.id === taskId);
  if (task === undefined) {
    return { ok: false, error: 'Cette tâche n’existe plus.' };
  }
  return {
    ok: true,
    value: {
      task,
      durationMinutes,
      effectiveWeight: getEffectiveWeight(state.household.plan, task.weight),
    },
  };
}

