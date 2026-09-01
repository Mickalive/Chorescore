import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { getEffectiveWeight, getEntitlements } from '../domain/entitlements';
import { applyRestartRules } from '../domain/timerRules';
import type { RestartEvent } from '../domain/timerRules';
import type {
  AppSnapshot,
  ConsentState,
  PlanScenario,
  PremiumFeature,
  TaskCategory,
  TodoItem,
} from '../domain/types';
import { analyticsService, appDataService } from '../services';
import { asyncStorageAdapter } from '../services/storage';
import {
  createInitialState,
  createLoadingState,
  createLocalHousehold,
  planAddTask,
  planArchiveTask,
  planCancelTimer,
  planCompleteTimer,
  planCompleteTodoItem,
  planCreateHousehold,
  planCreateTodoItem,
  planDeleteEntry,
  planEditEntryDuration,
  planManualEntry,
  planSetUser,
  planStartTimer,
  planSwitchHousehold,
  planUpdateTask,
  reducer,
  TERMS_VERSION,
} from './appReducer';
import type { AppState } from './appReducer';
import type { CreateTodoFormInput, CompleteTodoFormInput } from './appReducer';
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
  updateTask: (taskId: string, input: AddTaskInput) => boolean;
  archiveTask: (taskId: string) => void;
  startTimer: (taskId: string) => void;
  completeTimer: (entryId: string) => void;
  cancelTimer: (entryId: string) => void;
  addManualEntry: (taskId: string, durationMinutes: number, performedByMemberId: string) => boolean;
  editEntryDuration: (entryId: string, durationMinutes: number) => boolean;
  deleteEntry: (entryId: string) => void;
  createHousehold: (name: string) => boolean;
  switchHousehold: (householdId: string) => void;
  showPaywall: (feature: PremiumFeature) => void;
  hidePaywall: () => void;
  dismissNotice: () => void;
  resetDemo: () => void;
  retryHydration: () => void;
  /** DRC-04 : création d'une tâche future. */
  createTodoItem: (input: CreateTodoFormInput) => boolean;
  /** DRC-04 : conversion atomique d'une tâche future en réalisation. */
  completeTodoItem: (todoId: string, input: CompleteTodoFormInput) => boolean;
  /** DRC-04 : suppression d'une tâche future. */
  deleteTodoItem: (todoId: string) => void;
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
    households: state.households,
    memberships: state.memberships,
    tasks: state.tasks,
    entries: state.entries,
    currentUserId: state.currentUserId,
    currentHouseholdId: state.currentHouseholdId,
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
      const snapshot = appDataService.getInitialSnapshot(now);
      dispatch({
        type: 'HYDRATION_READY',
        snapshot,
        roster: { households: [snapshot.household], currentHouseholdId: snapshot.household.id },
        durable: { onboardingComplete: false, consent: freshConsent() },
        notice,
      });
      return;
    }
    const restored = outcome.state;
    // DRC-04 : le foyer actif se déduit du roster persisté. Le validateur
    // garantit l'existence du foyer actif ; le repli ci-dessous n'est là que
    // pour satisfaire le typage sans inventer de foyer.
    const household =
      restored.households.find((candidate) => candidate.id === restored.currentHouseholdId) ??
      restored.households[0];
    if (household === undefined) {
      dispatch({ type: 'HYDRATION_FAILED', message: HYDRATION_ERROR_MESSAGE });
      return;
    }
    // DRC-01 : support V2 (legacy) et V3 (canonical) state shapes.
    const isV3 = 'persistentTasks' in restored;
    const base: AppSnapshot = {
      users: restored.users,
      household,
      memberships: restored.memberships,
      tasks: isV3 ? [] : (restored as { tasks: AppSnapshot['tasks'] }).tasks,
      entries: isV3 ? [] : (restored as { entries: AppSnapshot['entries'] }).entries,
      currentUserId: restored.currentUserId,
    };
    // Reprise déterministe des chronos interrompus, horloge de référence passée
    // explicitement (jamais de compteur sérialisé).
    const { snapshot, events } = applyRestartRules(base, now);
    const notices = [
      outcome.migratedFrom === 1
        ? 'Format des données locales mis à niveau : tes foyers et historiques ont été conservés.'
        : null,
      describeRestartEvents(events),
    ].filter((item): item is string => item !== null);
    dispatch({
      type: 'HYDRATION_READY',
      snapshot,
      roster: { households: restored.households, currentHouseholdId: restored.currentHouseholdId },
      durable: {
        onboardingComplete: restored.onboardingComplete,
        consent: restored.consent,
        todoItems: isV3 ? (restored as { todoItems: import('../domain/types').TodoItem[] }).todoItems : [],
      },
      notice: notices.length > 0 ? notices.join(' ') : null,
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
    state.households,
    state.currentHouseholdId,
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

  // DRC-03 : modification réelle d'une tâche. Le service conserve
  // l'identifiant et la création ; les entrées existantes gardent leur score
  // figé, la sauvegarde durable suit via l'effet global.
  const updateTask = useCallback(
    (taskId: string, input: AddTaskInput) => {
      const plan = planUpdateTask(state, taskId, input);
      if (!plan.ok) {
        dispatch({ type: 'SET_NOTICE', notice: plan.error });
        return false;
      }
      const task = appDataService.updateTask({
        task: plan.value.task,
        name: plan.value.name,
        category: plan.value.category,
        weight: plan.value.weight,
      });
      dispatch({ type: 'UPDATE_TASK', task });
      return true;
    },
    [state],
  );

  const archiveTask = useCallback(
    (taskId: string) => {
      const plan = planArchiveTask(state, taskId);
      if (!plan.ok) {
        dispatch({ type: 'SET_NOTICE', notice: plan.error });
        return;
      }
      dispatch({ type: 'ARCHIVE_TASK', taskId: plan.value.id });
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

  // DRC-03 : annulation déterministe d'un chrono actif — aucune entrée
  // fantôme, cohérent avec applyRestartRules à la relance.
  const cancelTimer = useCallback(
    (entryId: string) => {
      const plan = planCancelTimer(state, entryId);
      if (!plan.ok) {
        dispatch({ type: 'SET_NOTICE', notice: plan.error });
        return;
      }
      dispatch({ type: 'CANCEL_TIMER', entryId: plan.value });
    },
    [state],
  );

  const addManualEntry = useCallback(
    (taskId: string, durationMinutes: number, performedByMemberId: string) => {
      const plan = planManualEntry(state, taskId, durationMinutes, performedByMemberId);
      if (!plan.ok) {
        dispatch({ type: 'SET_NOTICE', notice: plan.error });
        return false;
      }
      const entry = appDataService.createManualEntry({
        householdId: state.household.id,
        userId: plan.value.performedByMemberId,
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

  // DRC-03 : correction d'une entrée terminée — le score est recalculé par le
  // service depuis le weightSnapshot figé, jamais depuis le poids courant.
  const editEntryDuration = useCallback(
    (entryId: string, durationMinutes: number) => {
      const plan = planEditEntryDuration(state, entryId, durationMinutes);
      if (!plan.ok) {
        dispatch({ type: 'SET_NOTICE', notice: plan.error });
        return false;
      }
      const corrected = appDataService.editCompletedEntryDuration({
        entry: plan.value.entry,
        durationMinutes: plan.value.durationMinutes,
      });
      dispatch({ type: 'EDIT_ENTRY', entry: corrected });
      return true;
    },
    [state],
  );

  // DRC-03 : suppression confirmée d'une entrée terminée ; classement,
  // historique et document persisté sont recalculés sans orpheline.
  const deleteEntry = useCallback(
    (entryId: string) => {
      const plan = planDeleteEntry(state, entryId);
      if (!plan.ok) {
        dispatch({ type: 'SET_NOTICE', notice: plan.error });
        return;
      }
      dispatch({ type: 'DELETE_ENTRY', entryId: plan.value });
    },
    [state],
  );

  // DRC-04 : création réelle d'un foyer local — vide au départ, isolé dans le
  // document persisté, avec adhésion propriétaire pour la personne courante.
  const createHousehold = useCallback(
    (rawName: string) => {
      const plan = planCreateHousehold(state, rawName);
      if (!plan.ok) {
        dispatch({ type: 'SET_NOTICE', notice: plan.error });
        return false;
      }
      const now = new Date();
      const household = createLocalHousehold(plan.value.name, state.household, now);
      dispatch({ type: 'CREATE_HOUSEHOLD', household, joinedAt: now.toISOString() });
      return true;
    },
    [state],
  );

  const switchHousehold = useCallback(
    (householdId: string) => {
      const plan = planSwitchHousehold(state, householdId);
      if (!plan.ok) {
        dispatch({ type: 'SET_NOTICE', notice: plan.error });
        return;
      }
      dispatch({ type: 'SWITCH_HOUSEHOLD', householdId: plan.value.id });
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

  /* ------------------------------------------------------------------ */
  /* DRC-04 : tâches futures                                             */
  /* ------------------------------------------------------------------ */

  const createTodoItem = useCallback(
    (input: CreateTodoFormInput) => {
      const plan = planCreateTodoItem(state, input);
      if (!plan.ok) {
        dispatch({ type: 'SET_NOTICE', notice: plan.error });
        return false;
      }
      const now = new Date();
      const todo: TodoItem = {
        id: `todo_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
        householdId: state.household.id,
        label: input.label.trim(),
        assigneeMemberId: input.assigneeMemberId,
        beneficiaryMemberIds: input.beneficiaryMemberIds,
        dueDate: input.dueDate,
        note: input.note,
        persistentTaskId: null,
        createdAt: now.toISOString(),
        completedAt: null,
      };
      dispatch({ type: 'ADD_TODO', todo });
      return true;
    },
    [state],
  );

  const completeTodoItem = useCallback(
    (todoId: string, input: CompleteTodoFormInput) => {
      const plan = planCompleteTodoItem(state, todoId, input);
      if (!plan.ok) {
        dispatch({ type: 'SET_NOTICE', notice: plan.error });
        return false;
      }
      const { todo, performedByMemberId, durationMinutes, beneficiaryMemberIds } = plan.value;
      const now = new Date();
      const durationSeconds = durationMinutes * 60;

      // Créer ou récupérer la tâche liée
      let task = state.tasks.find(
        (t) => t.id === todo.persistentTaskId && t.householdId === state.household.id,
      );
      if (task === undefined) {
        // Créer une TaskDefinition pour cette tâche future
        task = appDataService.createTask({
          householdId: state.household.id,
          name: todo.label,
          category: 'other' as TaskCategory,
          weight: 1,
          now,
        });
        dispatch({ type: 'ADD_TASK', task });
      }

      const effectiveWeight = getEffectiveWeight(state.household.plan, task.weight);
      const entry = appDataService.createManualEntry({
        householdId: state.household.id,
        userId: performedByMemberId,
        task,
        effectiveWeight,
        durationMinutes,
        now,
      });
      analyticsService.track({ name: 'task_completed', occurredAt: now.toISOString() });
      dispatch({
        type: 'COMPLETE_TODO',
        todoId,
        entry,
      });
      return true;
    },
    [state],
  );

  const deleteTodoItem = useCallback(
    (todoId: string) => {
      const todo = state.todoItems.find(
        (t) => t.id === todoId && t.householdId === state.household.id,
      );
      if (todo === undefined) {
        dispatch({ type: 'SET_NOTICE', notice: 'Cette tâche est introuvable.' });
        return;
      }
      dispatch({ type: 'DELETE_TODO', todoId });
    },
    [state],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      completeOnboarding,
      setAnalyticsOptIn,
      setPlanScenario,
      setCurrentUser,
      addTask,
      updateTask,
      archiveTask,
      startTimer,
      completeTimer,
      cancelTimer,
      addManualEntry,
      editEntryDuration,
      deleteEntry,
      createHousehold,
      switchHousehold,
      showPaywall,
      hidePaywall,
      dismissNotice,
      resetDemo,
      retryHydration,
      createTodoItem,
      completeTodoItem,
      deleteTodoItem,
    }),
    [
      state,
      completeOnboarding,
      setAnalyticsOptIn,
      setPlanScenario,
      setCurrentUser,
      addTask,
      updateTask,
      archiveTask,
      startTimer,
      completeTimer,
      cancelTimer,
      addManualEntry,
      editEntryDuration,
      deleteEntry,
      createHousehold,
      switchHousehold,
      showPaywall,
      hidePaywall,
      dismissNotice,
      resetDemo,
      retryHydration,
      createTodoItem,
      completeTodoItem,
      deleteTodoItem,
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
