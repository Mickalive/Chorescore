import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInitialState,
  planAddTask,
  planCompleteTimer,
  planManualEntry,
  planSetUser,
  planStartTimer,
  reducer,
} from '../src/store/appReducer.js';
import type { AppState } from '../src/store/appReducer.js';
import { createDemoSnapshot } from '../src/data/demoData.js';
import { canAccessFeature } from '../src/domain/entitlements.js';
import type { PlanScenario, TaskEntry } from '../src/domain/types.js';

const NOW = new Date(2026, 7, 26, 12, 0, 0);

function createState(): AppState {
  return createInitialState(createDemoSnapshot(NOW));
}

function withPlan(state: AppState, plan: PlanScenario): AppState {
  return { ...state, household: { ...state.household, plan } };
}

function runningEntry(overrides?: Partial<TaskEntry>): TaskEntry {
  return {
    id: 'entry_running',
    taskId: 'task_dishes',
    householdId: 'household_rivage',
    userId: 'user_noa',
    status: 'in_progress',
    startedAt: new Date(2026, 7, 26, 11, 0, 0).toISOString(),
    completedAt: null,
    durationSeconds: 0,
    weightSnapshot: 2,
    score: 0,
    isManual: false,
    periodKey: 'test-week',
    ...overrides,
  };
}

test('l’état initial démarre hors onboarding, sans consentement ni paywall', () => {
  const state = createState();
  assert.equal(state.onboardingComplete, false);
  assert.equal(state.consent.termsAccepted, false);
  assert.equal(state.consent.analyticsOptIn, false);
  assert.equal(state.paywallFeature, null);
  assert.equal(state.notice, null);
  assert.equal(state.analyticsEventCount, 0);
  assert.equal(state.household.plan, 'trial');
});

test('compléter l’onboarding sépare les conditions du consentement analytique', () => {
  const accepted = reducer(createState(), {
    type: 'COMPLETE_ONBOARDING',
    consent: {
      termsAccepted: true,
      termsVersion: 'demo-v1',
      acceptedAt: NOW.toISOString(),
      analyticsOptIn: false,
    },
  });
  assert.equal(accepted.onboardingComplete, true);
  assert.equal(accepted.consent.termsAccepted, true);
  assert.equal(accepted.consent.analyticsOptIn, false);
});

test('le formulaire de tâche accepte une saisie valide et garde le poids en essai', () => {
  const state = createState();
  const plan = planAddTask(state, { name: '  Arroser   les plantes ', category: 'other', weight: 7 });
  assert.equal(plan.ok, true);
  if (plan.ok) {
    assert.equal(plan.value.weight, 7);
  }
  const task = {
    id: 'task_new',
    householdId: state.household.id,
    name: 'Arroser les plantes',
    category: 'other' as const,
    weight: 7,
    active: true,
    createdAt: NOW.toISOString(),
  };
  const next = reducer(state, { type: 'ADD_TASK', task });
  assert.equal(next.tasks[0]?.id, 'task_new');
  assert.equal(next.notice, 'La tâche a été ajoutée.');
});

test('le formulaire de tâche refuse un nom trop court ou un poids invalide', () => {
  const state = createState();
  const shortName = planAddTask(state, { name: ' A ', category: 'other', weight: 2 });
  assert.deepEqual(shortName, { ok: false, error: 'Le nom doit contenir au moins 2 caractères.' });
  const badWeight = planAddTask(state, { name: 'Arroser', category: 'other', weight: 0 });
  assert.deepEqual(badWeight, {
    ok: false,
    error: 'Le poids doit être un entier compris entre 1 et 1000.',
  });
});

test('en scénario gratuit, le poids saisi est ramené à 1 à l’enregistrement', () => {
  const state = withPlan(createState(), 'free');
  const plan = planAddTask(state, { name: 'Arroser', category: 'other', weight: 500 });
  assert.equal(plan.ok, true);
  if (plan.ok) {
    assert.equal(plan.value.weight, 1);
  }
});

test('démarrer un chrono crée une entrée en cours avec l’avis dédié', () => {
  const state = createState();
  const plan = planStartTimer(state, 'task_dishes');
  assert.equal(plan.ok, true);
  if (plan.ok) {
    assert.equal(plan.value.task.id, 'task_dishes');
    assert.equal(plan.value.effectiveWeight, 2);
  }
  const entry = runningEntry();
  const next = reducer(state, { type: 'ADD_ENTRY', entry, eventCount: 0 });
  assert.equal(next.entries[0]?.status, 'in_progress');
  assert.equal(next.notice, 'Chrono démarré.');
});

test('un second chrono simultané est refusé pour le même membre', () => {
  const base = createState();
  const state = { ...base, entries: [runningEntry(), ...base.entries] };
  const plan = planStartTimer(state, 'task_cooking');
  assert.deepEqual(plan, { ok: false, error: 'Termine le chrono actif avant d’en lancer un autre.' });
});

test('changer de membre autorise un chrono parallèle et ignore un membre inconnu', () => {
  const state = { ...createState(), entries: [runningEntry()] };
  const switchUser = planSetUser(state, 'user_camille');
  assert.deepEqual(switchUser, { ok: true, value: 'user_camille' });
  const otherUserState = reducer(state, { type: 'SET_USER', userId: 'user_camille' });
  assert.equal(otherUserState.currentUserId, 'user_camille');
  assert.equal(otherUserState.notice, null);
  const parallel = planStartTimer(otherUserState, 'task_cooking');
  assert.equal(parallel.ok, true);

  const unknown = planSetUser(state, 'user_intrus');
  assert.equal(unknown.ok, false);
});

test('terminer le chrono d’un autre membre est refusé', () => {
  const state = { ...createState(), entries: [runningEntry({ userId: 'user_camille' })] };
  const plan = planCompleteTimer(state, 'entry_running');
  assert.deepEqual(plan, { ok: false, error: 'Ce chrono n’est pas disponible.' });
});

test('terminer un chrono remplace l’entrée et publie le score mis à jour', () => {
  const state = { ...createState(), entries: [runningEntry()] };
  const plan = planCompleteTimer(state, 'entry_running');
  assert.equal(plan.ok, true);
  const completed = runningEntry({
    status: 'completed',
    completedAt: NOW.toISOString(),
    durationSeconds: 2700,
    score: 90,
  });
  const next = reducer(state, { type: 'REPLACE_ENTRY', entry: completed, eventCount: 3 });
  assert.equal(next.entries.find((item) => item.id === 'entry_running')?.score, 90);
  assert.equal(next.notice, 'Tâche terminée et score mis à jour.');
  assert.equal(next.analyticsEventCount, 3);
});

test('en scénario gratuit, le chrono démarre avec le poids effectif 1', () => {
  const state = withPlan(createState(), 'free');
  const plan = planStartTimer(state, 'task_bathroom');
  assert.equal(plan.ok, true);
  if (plan.ok) {
    assert.equal(plan.value.task.weight, 4);
    assert.equal(plan.value.effectiveWeight, 1);
  }
});

test('la saisie manuelle contrôle la durée avant l’existence de la tâche', () => {
  const state = createState();
  const zeroMinutes = planManualEntry(state, 'task_inconnue', 0, state.currentUserId);
  assert.deepEqual(zeroMinutes, {
    ok: false,
    error: 'La durée doit être un nombre entier entre 1 et 1440 minutes.',
  });
  const excessive = planManualEntry(state, 'task_dishes', 1441, state.currentUserId);
  assert.equal(excessive.ok, false);
  const unknownTask = planManualEntry(state, 'task_inconnue', 30, state.currentUserId);
  assert.deepEqual(unknownTask, { ok: false, error: 'Cette tâche n’existe plus.' });
});

test('la saisie manuelle valide produit une entrée prête pour l’historique', () => {
  const state = createState();
  const plan = planManualEntry(state, 'task_dishes', 30, state.currentUserId);
  assert.equal(plan.ok, true);
  if (plan.ok) {
    assert.equal(plan.value.task.id, 'task_dishes');
    assert.equal(plan.value.durationMinutes, 30);
    assert.equal(plan.value.effectiveWeight, 2);
  }
  const entry = runningEntry({
    id: 'entry_manual',
    status: 'completed',
    startedAt: null,
    completedAt: NOW.toISOString(),
    durationSeconds: 1800,
    score: 60,
    isManual: true,
  });
  const next = reducer(state, { type: 'ADD_ENTRY', entry, eventCount: 1 });
  assert.equal(next.notice, 'Temps ajouté.');
  assert.equal(next.entries[0]?.isManual, true);
});

test('le paywall s’ouvre sur une fonction premium et se referme', () => {
  let state = reducer(createState(), { type: 'SHOW_PAYWALL', feature: 'export_pdf' });
  assert.equal(state.paywallFeature, 'export_pdf');
  state = reducer(state, { type: 'HIDE_PAYWALL' });
  assert.equal(state.paywallFeature, null);
});

test('les fonctions premium suivent le scénario du foyer', () => {
  const freeHousehold = withPlan(createState(), 'free').household;
  assert.equal(canAccessFeature(freeHousehold, 'export_pdf'), false);
  assert.equal(canAccessFeature(freeHousehold, 'custom_weights'), false);
  const proHousehold = withPlan(createState(), 'pro').household;
  assert.equal(canAccessFeature(proHousehold, 'export_pdf'), true);
  assert.equal(canAccessFeature(proHousehold, 'multiple_households'), true);
});

test('les scénarios de plan mettent à jour le foyer et la limite de membres', () => {
  let state = reducer(createState(), { type: 'SET_PLAN', plan: 'standard', maxMembers: 7 });
  assert.equal(state.household.plan, 'standard');
  assert.equal(state.household.maxMembers, 7);
  assert.equal(state.notice, 'Scénario standard activé pour tout le foyer.');
  state = reducer(state, { type: 'SET_PLAN', plan: 'pro', maxMembers: null });
  assert.equal(state.household.plan, 'pro');
  assert.equal(state.household.maxMembers, null);
});

test('le consentement analytique reste révocable dans l’état', () => {
  let state = reducer(createState(), { type: 'SET_ANALYTICS_CONSENT', enabled: true, eventCount: 4 });
  assert.equal(state.consent.analyticsOptIn, true);
  assert.equal(state.analyticsEventCount, 4);
  state = reducer(state, { type: 'SET_ANALYTICS_CONSENT', enabled: false, eventCount: 0 });
  assert.equal(state.consent.analyticsOptIn, false);
  assert.equal(state.analyticsEventCount, 0);
});

test('réinitialiser la démo restaure les données sans effacer le consentement', () => {
  let state = reducer(createState(), {
    type: 'COMPLETE_ONBOARDING',
    consent: {
      termsAccepted: true,
      termsVersion: 'demo-v1',
      acceptedAt: NOW.toISOString(),
      analyticsOptIn: true,
    },
  });
  state = reducer(state, { type: 'SHOW_PAYWALL', feature: 'advanced_history' });
  const freshSnapshot = createDemoSnapshot(NOW);
  state = reducer(state, { type: 'RESET_DEMO', snapshot: freshSnapshot });
  assert.equal(state.paywallFeature, null);
  assert.equal(state.notice, 'Les données fictives ont été réinitialisées.');
  assert.equal(state.onboardingComplete, true);
  assert.equal(state.consent.analyticsOptIn, true);
  assert.deepEqual(state.tasks, freshSnapshot.tasks);
  assert.deepEqual(state.entries, freshSnapshot.entries);
});

