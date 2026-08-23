import React, { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
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
import { analyticsService, appDataService } from '../services';

type AppState = AppSnapshot & {
  onboardingComplete: boolean;
  consent: ConsentState;
  paywallFeature: PremiumFeature | null;
  notice: string | null;
  analyticsEventCount: number;
};

type Action =
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

function createInitialState(): AppState {
  return {
    ...appDataService.getInitialSnapshot(),
    onboardingComplete: false,
    consent: {
      termsAccepted: false,
      termsVersion: 'demo-v1',
      acceptedAt: null,
      analyticsOptIn: false,
    },
    paywallFeature: null,
    notice: null,
    analyticsEventCount: 0,
  };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
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

type AddTaskInput = {
  name: string;
  category: TaskCategory;
  weight: number;
};

type AppContextValue = {
  state: AppState;
  completeOnboarding: (analyticsOptIn: boolean) => void;
  setAnalyticsOptIn: (enabled: boolean) => void;
  setPlanScenario: (plan: PlanScenario) => void;
  setCurrentUser: (userId: string) => void;
  addTask: (input: AddTaskInput) => boolean;
  startTimer: (taskId: string) => void;
  completeTimer: (entryId: string) => void;
  addManualEntry: (taskId: string, durationMinutes: number) => boolean;
  showPaywall: (feature: PremiumFeature) => void;
  hidePaywall: () => void;
  dismissNotice: () => void;
  resetDemo: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  const completeOnboarding = useCallback((analyticsOptIn: boolean) => {
    analyticsService.setConsent(analyticsOptIn);
    dispatch({
      type: 'COMPLETE_ONBOARDING',
      consent: {
        termsAccepted: true,
        termsVersion: 'demo-v1',
        acceptedAt: new Date().toISOString(),
        analyticsOptIn,
      },
    });
  }, []);

  const setAnalyticsOptIn = useCallback((enabled: boolean) => {
    analyticsService.setConsent(enabled);
    dispatch({
      type: 'SET_ANALYTICS_CONSENT',
      enabled,
      eventCount: analyticsService.getInMemoryEventCount(),
    });
  }, []);

  const setPlanScenario = useCallback((plan: PlanScenario) => {
    analyticsService.track({ name: 'plan_previewed', occurredAt: new Date().toISOString() });
    dispatch({ type: 'SET_PLAN', plan, maxMembers: getEntitlements(plan).maxMembers });
  }, []);

  const setCurrentUser = useCallback((userId: string) => {
    if (state.users.some((user) => user.id === userId)) {
      dispatch({ type: 'SET_USER', userId });
    }
  }, [state.users]);

  const addTask = useCallback(
    (input: AddTaskInput) => {
      const error = validateTaskInput(input);
      if (error !== null) {
        dispatch({ type: 'SET_NOTICE', notice: error });
        return false;
      }
      const entitlements = getEntitlements(state.household.plan);
      const effectiveWeight = entitlements.canCustomizeWeights ? input.weight : 1;
      const task = appDataService.createTask({
        householdId: state.household.id,
        name: input.name,
        category: input.category,
        weight: effectiveWeight,
        now: new Date(),
      });
      dispatch({ type: 'ADD_TASK', task });
      return true;
    },
    [state.household],
  );

  const startTimer = useCallback(
    (taskId: string) => {
      const task = state.tasks.find((candidate) => candidate.id === taskId);
      if (task === undefined) {
        dispatch({ type: 'SET_NOTICE', notice: 'Cette tâche n’existe plus.' });
        return;
      }
      const alreadyRunning = state.entries.some(
        (entry) => entry.userId === state.currentUserId && entry.status === 'in_progress',
      );
      if (alreadyRunning) {
        dispatch({ type: 'SET_NOTICE', notice: 'Termine le chrono actif avant d’en lancer un autre.' });
        return;
      }
      const entry = appDataService.startTimer({
        householdId: state.household.id,
        userId: state.currentUserId,
        task,
        effectiveWeight: getEffectiveWeight(state.household.plan, task.weight),
        now: new Date(),
      });
      dispatch({ type: 'ADD_ENTRY', entry, eventCount: analyticsService.getInMemoryEventCount() });
    },
    [state.currentUserId, state.entries, state.household, state.tasks],
  );

  const completeTimer = useCallback(
    (entryId: string) => {
      const entry = state.entries.find(
        (candidate) => candidate.id === entryId && candidate.userId === state.currentUserId,
      );
      if (entry === undefined || entry.status !== 'in_progress') {
        dispatch({ type: 'SET_NOTICE', notice: 'Ce chrono n’est pas disponible.' });
        return;
      }
      const completed = appDataService.completeTimer({ entry, now: new Date() });
      analyticsService.track({ name: 'task_completed', occurredAt: new Date().toISOString() });
      dispatch({
        type: 'REPLACE_ENTRY',
        entry: completed,
        eventCount: analyticsService.getInMemoryEventCount(),
      });
    },
    [state.currentUserId, state.entries],
  );

  const addManualEntry = useCallback(
    (taskId: string, durationMinutes: number) => {
      const error = validateManualMinutes(durationMinutes);
      if (error !== null) {
        dispatch({ type: 'SET_NOTICE', notice: error });
        return false;
      }
      const task = state.tasks.find((candidate) => candidate.id === taskId);
      if (task === undefined) {
        dispatch({ type: 'SET_NOTICE', notice: 'Cette tâche n’existe plus.' });
        return false;
      }
      const entry = appDataService.createManualEntry({
        householdId: state.household.id,
        userId: state.currentUserId,
        task,
        effectiveWeight: getEffectiveWeight(state.household.plan, task.weight),
        durationMinutes,
        now: new Date(),
      });
      analyticsService.track({ name: 'task_completed', occurredAt: new Date().toISOString() });
      dispatch({ type: 'ADD_ENTRY', entry, eventCount: analyticsService.getInMemoryEventCount() });
      return true;
    },
    [state.currentUserId, state.household, state.tasks],
  );

  const showPaywall = useCallback((feature: PremiumFeature) => {
    analyticsService.track({ name: 'feature_opened', occurredAt: new Date().toISOString() });
    dispatch({ type: 'SHOW_PAYWALL', feature });
  }, []);

  const hidePaywall = useCallback(() => dispatch({ type: 'HIDE_PAYWALL' }), []);
  const dismissNotice = useCallback(() => dispatch({ type: 'SET_NOTICE', notice: null }), []);
  const resetDemo = useCallback(() => dispatch({ type: 'RESET_DEMO', snapshot: appDataService.getInitialSnapshot() }), []);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      completeOnboarding,
      setAnalyticsOptIn,
      setPlanScenario,
      setCurrentUser,
      addTask,
      startTimer,
      completeTimer,
      addManualEntry,
      showPaywall,
      hidePaywall,
      dismissNotice,
      resetDemo,
    }),
    [
      state,
      completeOnboarding,
      setAnalyticsOptIn,
      setPlanScenario,
      setCurrentUser,
      addTask,
      startTimer,
      completeTimer,
      addManualEntry,
      showPaywall,
      hidePaywall,
      dismissNotice,
      resetDemo,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (value === null) {
    throw new Error('useApp doit être utilisé dans AppProvider.');
  }
  return value;
}
