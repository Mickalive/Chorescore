import React, { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import { getEntitlements } from '../domain/entitlements';
import type {
  ConsentState,
  PlanScenario,
  PremiumFeature,
  TaskCategory,
} from '../domain/types';
import { analyticsService, appDataService } from '../services';
import {
  createInitialState,
  planAddTask,
  planCompleteTimer,
  planManualEntry,
  planSetUser,
  planStartTimer,
  reducer,
  TERMS_VERSION,
} from './appReducer';
import type { AppState } from './appReducer';

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
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    () => createInitialState(appDataService.getInitialSnapshot()),
  );

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

