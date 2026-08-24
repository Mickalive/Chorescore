import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInitialState,
  planAddTask,
  planCompleteTimer,
  planSetUser,
  planStartTimer,
  reducer,
} from '../src/store/appReducer.js';
import type { AppState } from '../src/store/appReducer.js';
import { createDemoSnapshot } from '../src/data/demoData.js';
import { DemoAppService } from '../src/services/demoService.js';
import { buildDailyHistory, buildLeaderboard, getVisibleHistory } from '../src/domain/leaderboard.js';
import { getEffectiveWeight, getEntitlements } from '../src/domain/entitlements.js';
import { normalizeTaskName, validateManualMinutes, validateTaskInput } from '../src/domain/validation.js';
import type { PlanScenario, TaskCategory, TaskEntry } from '../src/domain/types.js';

const NOW = new Date(2026, 7, 26, 12, 0, 0); // mercredi 26 août 2026, 12:00 locale
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function createState(): AppState {
  return createInitialState(createDemoSnapshot(NOW));
}

function withPlan(state: AppState, plan: PlanScenario): AppState {
  return { ...state, household: { ...state.household, plan } };
}

function requiredTask(state: AppState, taskId: string) {
  const task = state.tasks.find((candidate) => candidate.id === taskId);
  if (task === undefined) {
    throw new Error(`Tâche de démonstration absente : ${taskId}`);
  }
  return task;
}

function runningEntry(overrides?: Partial<TaskEntry>): TaskEntry {
  return {
    id: 'entry_running',
    taskId: 'task_dishes',
    householdId: 'household_rivage',
    userId: 'user_noa',
    status: 'in_progress',
    startedAt: new Date(NOW.getTime() - 10 * MINUTE_MS).toISOString(),
    completedAt: null,
    durationSeconds: 0,
    weightSnapshot: 2,
    score: 0,
    isManual: false,
    periodKey: 'test-week',
    ...overrides,
  };
}

// ——— Onglet Tâches ———

test('parcours tâches : création, double chrono refusé, complétion au score canonique', () => {
  const service = new DemoAppService();
  let state = createState();

  const plannedTask = planAddTask(state, { name: '  Arroser\nles plantes ', category: 'other', weight: 7 });
  assert.equal(plannedTask.ok, true);
  if (!plannedTask.ok) return;
  const task = service.createTask({
    householdId: state.household.id,
    name: plannedTask.value.name,
    category: plannedTask.value.category,
    weight: plannedTask.value.weight,
    now: NOW,
  });
  state = reducer(state, { type: 'ADD_TASK', task });
  assert.equal(state.tasks[0]?.name, 'Arroser les plantes');
  assert.equal(state.notice, 'La tâche a été ajoutée.');

  const startPlan = planStartTimer(state, task.id);
  assert.equal(startPlan.ok, true);
  if (!startPlan.ok) return;
  assert.equal(startPlan.value.effectiveWeight, 7); // essai : poids personnalisé conservé
  const entry = service.startTimer({
    householdId: state.household.id,
    userId: state.currentUserId,
    task: startPlan.value.task,
    effectiveWeight: startPlan.value.effectiveWeight,
    now: NOW,
  });
  state = reducer(state, { type: 'ADD_ENTRY', entry, eventCount: 0 });
  assert.equal(state.notice, 'Chrono démarré.');

  const duplicate = planStartTimer(state, task.id);
  assert.equal(duplicate.ok, false);
  if (duplicate.ok) return;
  assert.equal(duplicate.error, 'Termine le chrono actif avant d’en lancer un autre.');
  state = reducer(state, { type: 'SET_NOTICE', notice: duplicate.error });

  const completePlan = planCompleteTimer(state, entry.id);
  assert.equal(completePlan.ok, true);
  if (!completePlan.ok) return;
  const completed = service.completeTimer({
    entry: completePlan.value.entry,
    now: new Date(NOW.getTime() + 45 * MINUTE_MS),
  });
  assert.equal(completed.durationSeconds, 2700);
  assert.equal(completed.score, 315); // (2700 / 60) × 7, arrondi réservé à l'affichage
  state = reducer(state, { type: 'REPLACE_ENTRY', entry: completed, eventCount: 1 });
  assert.equal(state.notice, 'Tâche terminée et score mis à jour.');
  assert.equal(state.entries[0]?.status, 'completed');
});

test('démarrer un chrono sur une tâche inconnue est refusé avec un message compréhensible', () => {
  const state = createState();
  const plan = planStartTimer(state, 'task_disparue');
  assert.deepEqual(plan, { ok: false, error: 'Cette tâche n’existe plus.' });
});

test('terminer un chrono déjà terminé est refusé', () => {
  const base = createState();
  const done = runningEntry({ id: 'entry_done', status: 'completed', completedAt: NOW.toISOString() });
  const state = { ...base, entries: [done, ...base.entries] };
  assert.deepEqual(planCompleteTimer(state, 'entry_done'), {
    ok: false,
    error: 'Ce chrono n’est pas disponible.',
  });
});

// ——— Onglet Classement ———

test('classement : deux saisies terminées cette semaine produisent rangs et parts cohérents', () => {
  const service = new DemoAppService();
  const base: AppState = { ...createState(), entries: [] }; // semaine vierge, hors données de semis
  const dishes = requiredTask(base, 'task_dishes');
  let state: AppState = base;

  const noaEntry = service.createManualEntry({
    householdId: state.household.id,
    userId: 'user_noa',
    task: dishes,
    effectiveWeight: 2,
    durationMinutes: 30,
    now: new Date(NOW.getTime() - 30 * MINUTE_MS),
  });
  const camilleEntry = service.createManualEntry({
    householdId: state.household.id,
    userId: 'user_camille',
    task: dishes,
    effectiveWeight: 2,
    durationMinutes: 20,
    now: new Date(NOW.getTime() - 15 * MINUTE_MS),
  });
  state = reducer(state, { type: 'ADD_ENTRY', entry: noaEntry, eventCount: 0 });
  state = reducer(state, { type: 'ADD_ENTRY', entry: camilleEntry, eventCount: 0 });

  const rows = buildLeaderboard(
    state.entries,
    state.users,
    state.memberships,
    state.household.id,
    'week',
    NOW,
    true,
  );
  const noa = rows.find((row) => row.user.id === 'user_noa');
  const camille = rows.find((row) => row.user.id === 'user_camille');
  assert.equal(noa?.rank, 1);
  assert.equal(noa?.value, 60);
  assert.equal(noa?.contribution, 60);
  assert.equal(camille?.rank, 2);
  assert.equal(camille?.value, 40);
  assert.equal(camille?.contribution, 40);
  assert.equal(Math.round(rows.reduce((sum, row) => sum + row.contribution, 0)), 100);
});

test('un chrono en cours ne change ni le classement ni l’historique', () => {
  const base = createState();
  const state = { ...base, entries: [runningEntry(), ...base.entries] };

  const rowsWithout = buildLeaderboard(
    base.entries,
    base.users,
    base.memberships,
    base.household.id,
    'week',
    NOW,
    true,
  );
  const rowsWith = buildLeaderboard(
    state.entries,
    state.users,
    state.memberships,
    state.household.id,
    'week',
    NOW,
    true,
  );
  assert.deepEqual(rowsWith, rowsWithout);

  const historyWithout = getVisibleHistory(base.entries, base.household.id, null, NOW);
  const historyWith = getVisibleHistory(state.entries, base.household.id, null, NOW);
  assert.deepEqual(historyWith, historyWithout);
});

test('classement mensuel en gratuit : le paywall s’ouvre sans changer le scénario', () => {
  let state = withPlan(createState(), 'free');
  assert.equal(getEntitlements('free').canViewMonthlyLeaderboard, false);

  // Logique d'écran : en gratuit, « Ce mois » déclenche le paywall, pas le changement de période.
  state = reducer(state, { type: 'SHOW_PAYWALL', feature: 'advanced_history' });
  assert.equal(state.paywallFeature, 'advanced_history');
  assert.equal(state.household.plan, 'free');
  state = reducer(state, { type: 'HIDE_PAYWALL' });
  assert.equal(state.paywallFeature, null);

  const premiumPlans: PlanScenario[] = ['trial', 'standard', 'pro'];
  for (const plan of premiumPlans) {
    assert.equal(getEntitlements(plan).canViewMonthlyLeaderboard, true);
  }
});

// ——— Onglet Historique ———

test('historique : les saisies terminées apparaissent de la plus récente à la plus ancienne', () => {
  const service = new DemoAppService();
  const base: AppState = { ...createState(), entries: [] };
  const dishes = requiredTask(base, 'task_dishes');

  const olderManual = service.createManualEntry({
    householdId: base.household.id,
    userId: base.currentUserId,
    task: dishes,
    effectiveWeight: 1,
    durationMinutes: 10,
    now: new Date(NOW.getTime() - 2 * HOUR_MS),
  });
  const newerManual = service.createManualEntry({
    householdId: base.household.id,
    userId: base.currentUserId,
    task: dishes,
    effectiveWeight: 1,
    durationMinutes: 12,
    now: new Date(NOW.getTime() - 30 * MINUTE_MS),
  });
  const timedEntry = service.completeTimer({
    entry: service.startTimer({
      householdId: base.household.id,
      userId: base.currentUserId,
      task: dishes,
      effectiveWeight: 2,
      now: new Date(NOW.getTime() - HOUR_MS),
    }),
    now: new Date(NOW.getTime() - 45 * MINUTE_MS),
  });

  let state = reducer(base, { type: 'ADD_ENTRY', entry: olderManual, eventCount: 0 });
  state = reducer(state, { type: 'ADD_ENTRY', entry: newerManual, eventCount: 0 });
  state = reducer(state, { type: 'ADD_ENTRY', entry: timedEntry, eventCount: 0 });

  const visible = getVisibleHistory(state.entries, state.household.id, null, NOW);
  assert.deepEqual(visible.map((entry) => entry.id), [newerManual.id, timedEntry.id, olderManual.id]);
  assert.equal(visible.some((entry) => entry.isManual), true);
  assert.equal(visible.some((entry) => !entry.isManual), true);
});

test('historique gratuit : fenêtre de 30 jours et graphique quotidien comblant les jours vides', () => {
  const service = new DemoAppService();
  const base: AppState = { ...createState(), entries: [] };
  const dishes = requiredTask(base, 'task_dishes');

  const recent = service.createManualEntry({
    householdId: base.household.id,
    userId: base.currentUserId,
    task: dishes,
    effectiveWeight: 1,
    durationMinutes: 10,
    now: new Date(NOW.getTime() - 2 * DAY_MS),
  });
  const old = service.createManualEntry({
    householdId: base.household.id,
    userId: base.currentUserId,
    task: dishes,
    effectiveWeight: 1,
    durationMinutes: 15,
    now: new Date(NOW.getTime() - 31 * DAY_MS),
  });
  let state = reducer(base, { type: 'ADD_ENTRY', entry: recent, eventCount: 0 });
  state = reducer(state, { type: 'ADD_ENTRY', entry: old, eventCount: 0 });

  const free = getEntitlements('free');
  assert.equal(free.historyDays, 30);
  const visible = getVisibleHistory(state.entries, state.household.id, free.historyDays, NOW);
  assert.deepEqual(visible.map((entry) => entry.id), [recent.id]);

  const points = buildDailyHistory(
    state.entries,
    state.currentUserId,
    state.household.id,
    7,
    NOW,
    false,
  );
  assert.equal(points.length, 7);
  assert.equal(points.at(-3)?.value, 10); // saisie à J-2, en temps brut : 10 minutes
  assert.equal(points.filter((point) => point.value === 0).length, 6);
});

// ——— Onglet Profil ———

test('profil : changer de scénario met à jour foyer, avis et poids effectif', () => {
  let state = reducer(createState(), { type: 'SET_PLAN', plan: 'standard', maxMembers: 7 });
  assert.equal(state.household.plan, 'standard');
  assert.equal(state.household.maxMembers, 7);
  assert.equal(getEffectiveWeight('standard', 3), 3);

  state = reducer(state, { type: 'SET_PLAN', plan: 'free', maxMembers: null });
  assert.equal(state.household.plan, 'free');
  assert.equal(state.household.maxMembers, null);
  assert.equal(getEffectiveWeight('free', 3), 1);
  assert.equal(state.notice, 'Scénario free activé pour tout le foyer.');
});

test('profil : un membre inconnu est refusé, un membre valide devient actif et efface l’avis', () => {
  let state = reducer(createState(), { type: 'SET_NOTICE', notice: 'Chrono démarré.' });
  const refused = planSetUser(state, 'user_intrus');
  assert.deepEqual(refused, { ok: false, error: 'Ce membre est introuvable dans ce foyer.' });
  assert.equal(state.currentUserId, 'user_noa');

  state = reducer(state, { type: 'SET_USER', userId: 'user_camille' });
  assert.equal(state.currentUserId, 'user_camille');
  assert.equal(state.notice, null);
});

// ——— Modales et erreurs de saisie ———

test('modale tâche : nom trop long, catégorie invalide et poids non entier sont refusés', () => {
  assert.equal(
    validateTaskInput({ name: 'x'.repeat(61), category: 'other', weight: 1 }),
    'Le nom ne peut pas dépasser 60 caractères.',
  );
  assert.equal(
    validateTaskInput({ name: 'Ranger', category: 'jardin' as TaskCategory, weight: 1 }),
    'La catégorie sélectionnée est invalide.',
  );
  assert.equal(
    validateTaskInput({ name: 'Ranger', category: 'other', weight: 2.5 }),
    'Le poids doit être un entier compris entre 1 et 1000.',
  );
});

test('les séparateurs de collage (C0, DEL, C1) ne soude pas les mots d’un nom collé', () => {
  assert.equal(normalizeTaskName('Arroser\nles plantes'), 'Arroser les plantes');
  assert.equal(normalizeTaskName('Ranger\u0007le\u0085salon'), 'Ranger le salon');
  // Un nom uniquement composé de contrôles reste rejeté après normalisation.
  assert.equal(
    validateTaskInput({ name: '\u0007\u0085', category: 'other', weight: 1 }),
    'Le nom doit contenir au moins 2 caractères.',
  );
});

test('modale durée : minutes fractionnaires ou non numériques refusées, borne haute acceptée', () => {
  assert.equal(
    validateManualMinutes(12.5),
    'La durée doit être un nombre entier entre 1 et 1440 minutes.',
  );
  assert.equal(
    validateManualMinutes(Number.NaN),
    'La durée doit être un nombre entier entre 1 et 1440 minutes.',
  );
  assert.equal(validateManualMinutes(1440), null);
});
