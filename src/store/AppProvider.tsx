import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { getEntitlements } from '../domain/entitlements';
import { applyRestartRules } from '../domain/timerRules';
import type { RestartEvent } from '../domain/timerRules';
import type {
  AppSnapshot,
  ConsentState,
  PlanScenario,
  PremiumFeature,
  TaskCategory,
} from '../domain/types';
import { analyticsService, appDataService } from '../services';
import { asyncStorageAdapter } from '../services/storage';
import {
  createInitialState,
  createLoadingState,
  planAddTask,
  planCompleteTimer,
  planManualEntry,
  planSetUser,
  planStartTimer,
  reducer,
  TERMS_VERSION,
} from './appReducer';
import type { AppState } from './appReducer';
import type { DurableState, KeyValueStorage } from './persistence';
import { createSequentialWriter, loadDurableState } from './persistence';

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
  retryHydration: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

const HYDRATION_ERROR_MESSAGE =
  'Les données locales n’ont pas pu être lues. La démonstration reste fermée pour protéger tes données : réessaie.';

const SAVE_ERROR_NOTICE =
  'Sauvegarde locale impossible pour le moment ; les modifications restent en mémoire.';

function freshConsent(): ConsentState {
  return {
    termsAccepted: false,
    termsVersion: TERMS_VERSION,
    acceptedAt: null,
    analyticsOptIn: false,
  };
}

function toDurableState(state: AppState): DurableState {
  return {
    users: state.users,
    household: state.household,
    memberships: state.memberships,
    tasks: state.tasks,
    entries: state.entries,
    currentUserId: state.currentUserId,
    onboardingComplete: state.onboardingComplete,
    consent: state.consent,
  };
}

function describeRestartEvents(events: RestartEvent[]): string | null {
  if (events.some((event) => event.kind === 'expired')) {
    return 'Un chrono resté ouvert plus de 24 h a été clôturé automatiquement à la reprise.';
  }
  if (events.some((event) => event.kind === 'repaired')) {
    return 'Une entrée incomplète a été clôturée à la reprise pour éviter un chrono bloqué.';
  }
  if (events.some((event) => event.kind === 'resumed')) {
    return 'Chrono repris : l’écoulement continue depuis l’heure de départ d’avant la fermeture.';
  }
  return null;
}

function describeRecovery(reason: string, quarantined: boolean): string {
  const detail = quarantined
    ? 'La charge illisible a été mise de côté sur l’appareil.'
    : 'La charge illisible n’a pas pu être archivée.';
  if (reason === 'unknown-version') {
    return `Ces données viennent d’une version plus récente de l’application. ${detail} La démonstration redémarre avec des données fictives.`;
  }
  return `Les données précédentes étaient illisibles. ${detail} La démonstration redémarre avec des données fictives.`;
}

export function AppProvider({
  children,
  storage = asyncStorageAdapter,
}: {
  children: React.ReactNode;
  storage?: KeyValueStorage;
}) {
  const [state, dispatch] = useReducer(reducer, undefined, createLoadingState);

  const hydrate = useCallback(async () => {
    dispatch({ type: 'HYDRATION_RESTART' });
    const outcome = await loadDurableState(storage);
    if (outcome.status === 'unavailable') {
      dispatch({ type: 'HYDRATION_FAILED', message: HYDRATION_ERROR_MESSAGE });
      return;
    }
    const now = new Date();
    if (outcome.status === 'first-launch' || outcome.status === 'recovered') {
      const notice =
        outcome.status === 'recovered'
          ? describeRecovery(outcome.reason, outcome.quarantined)
          : null;
      dispatch({
        type: 'HYDRATION_READY',
        snapshot: appDataService.getInitialSnapshot(now),
        durable: { onboardingComplete: false, consent: freshConsent() },
        notice,
      });
      return;
    }
    const restored = outcome.state;
    const base: AppSnapshot = {
      users: restored.users,
      household: restored.household,
      memberships: restored.memberships,
      tasks: restored.tasks,
      entries: restored.entries,
      currentUserId: restored.currentUserId,
    };
    // Reprise déterministe des chronos interrompus, horloge de référence passée
    // explicitement (jamais de compteur sérialisé).
    const { snapshot, events } = applyRestartRules(base, now);
    dispatch({
      type: 'HYDRATION_READY',
      snapshot,
      durable: {
        onboardingComplete: restored.onboardingComplete,
        consent: restored.consent,
      },
      notice: describeRestartEvents(events),
    });
  }, [storage]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const retryHydration = useCallback(() => {
    void hydrate();
  }, [hydrate]);

  // Sauvegarde de la tranche durable après chaque mutation métier, sérialisée
  // pour éviter tout entrelacement d'écritures.
  const writeDurable = useMemo(() => createSequentialWriter(storage), [storage]);
  useEffect(() => {
    if (state.hydration.phase !== 'ready') {
      return;
    }
    let cancelled = false;
    void writeDurable(toDurableState(state), new Date().toISOString()).then((outcome) => {
      if (!cancelled && !outcome.ok && outcome.error === 'write-failed') {
        dispatch({ type: 'SET_NOTICE', notice: SAVE_ERROR_NOTICE });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    writeDurable,
    state.hydration.phase,
    state.users,
    state.household,
    state.memberships,
    state.tasks,
    state.entries,
    state.currentUserId,
    state.onboardingComplete,
    state.consent,
  ]);

  const completeOnboarding = useCallback((analyticsOptIn: boolean) => {
    analyticsService.setConsent(analyticsOptIn);
    const consent: ConsentState = {
      termsAccepted: true,
      termsVersion: TERMS_VERSION,
      acceptedAt: new Date().toISOString(),
      analyticsOptIn,
    };
    dispatch({ type: 'COMPLETE_ONBOARDING', consent });
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

  const setCurrentUser = useCallback(
    (userId: string) => {
      const plan = planSetUser(state, userId);
      if (!plan.ok) {
        return;
      }
      dispatch({ type: 'SET_USER', userId: plan.value });
    },
    [state],
  );

  const addTask = useCallback(
    (input: AddTaskInput) => {
      const plan = planAddTask(state, input);
      if (!plan.ok) {
        dispatch({ type: 'SET_NOTICE', notice: plan.error });
        return false;
      }
      const task = appDataService.createTask({
        householdId: state.household.id,
        name: plan.value.name,
        category: plan.value.category,
        weight: plan.value.weight,
        now: new Date(),
      });
      dispatch({ type: 'ADD_TASK', task });
      return true;
    },
    [state],
  );

  const startTimer = useCallback(
    (taskId: string) => {
      const plan = planStartTimer(state, taskId);
      if (!plan.ok) {
        dispatch({ type: 'SET_NOTICE', notice: plan.error });
        return;
      }
      const entry = appDataService.startTimer({
        householdId: state.household.id,
        userId: state.currentUserId,
        task: plan.value.task,
        effectiveWeight: plan.value.effectiveWeight,
        now: new Date(),
      });
      dispatch({ type: 'ADD_ENTRY', entry, eventCount: analyticsService.getInMemoryEventCount() });
    },
    [state],
  );

  const completeTimer = useCallback(
    (entryId: string) => {
      const plan = planCompleteTimer(state, entryId);
      if (!plan.ok) {
        dispatch({ type: 'SET_NOTICE', notice: plan.error });
        return;
      }
      const completed = appDataService.completeTimer({ entry: plan.value.entry, now: new Date() });
      analyticsService.track({ name: 'task_completed', occurredAt: new Date().toISOString() });
      dispatch({
        type: 'REPLACE_ENTRY',
        entry: completed,
        eventCount: analyticsService.getInMemoryEventCount(),
      });
    },
    [state],
  );

  const addManualEntry = useCallback(
    (taskId: string, durationMinutes: number) => {
      const plan = planManualEntry(state, taskId, durationMinutes);
      if (!plan.ok) {
        dispatch({ type: 'SET_NOTICE', notice: plan.error });
        return false;
      }
      const entry = appDataService.createManualEntry({
        householdId: state.household.id,
        userId: state.currentUserId,
        task: plan.value.task,
        effectiveWeight: plan.value.effectiveWeight,
        durationMinutes: plan.value.durationMinutes,
        now: new Date(),
      });
      analyticsService.track({ name: 'task_completed', occurredAt: new Date().toISOString() });
      dispatch({ type: 'ADD_ENTRY', entry, eventCount: analyticsService.getInMemoryEventCount() });
      return true;
    },
    [state],
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
      retryHydration,
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
      retryHydration,
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
