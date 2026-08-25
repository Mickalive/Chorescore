import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInitialState,
  planArchiveTask,
  planCancelTimer,
  planCompleteTimer,
  planDeleteEntry,
  planEditEntryDuration,
  planManualEntry,
  planStartTimer,
  planUpdateTask,
  reducer,
} from '../src/store/appReducer.js';
import type { AppState } from '../src/store/appReducer.js';
import type { KeyValueStorage } from '../src/store/persistence.js';
import {
  QUARANTINE_KEY,
  STORAGE_KEY,
  loadDurableState,
  parseEnvelope,
  saveDurableState,
  serializeEnvelope,
} from '../src/store/persistence.js';
import type { DurableState } from '../src/store/persistence.js';
import { createDemoSnapshot } from '../src/data/demoData.js';
import { DemoAppService } from '../src/services/demoService.js';
import { ProductionAppService } from '../src/services/productionService.js';
import { ProductionModeDisabledError } from '../src/services/appService.js';
import { selectActiveTasks } from '../src/domain/tasks.js';
import { buildHistorySynthesis } from '../src/domain/history.js';
import { buildLeaderboard, getVisibleHistory } from '../src/domain/leaderboard.js';
import { applyRestartRules } from '../src/domain/timerRules.js';
import type { PlanScenario, TaskDefinition, TaskEntry } from '../src/domain/types.js';

const NOW = new Date(2026, 7, 26, 12, 0, 0); // mercredi 26 août 2026, 12:00 locale
const MINUTE_MS = 60 * 1000;

function createState(): AppState {
  return createInitialState(createDemoSnapshot(NOW));
}

function withPlan(state: AppState, plan: PlanScenario): AppState {
  return { ...state, household: { ...state.household, plan } };
}

function requiredTask(state: AppState, taskId: string): TaskDefinition {
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

class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  failGet = false;
  failSet = false;

  async getItem(key: string): Promise<string | null> {
    if (this.failGet) {
      throw new Error('stockage verrouillé');
    }
    return this.map.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.failSet) {
      throw new Error('stockage saturé');
    }
    this.map.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.map.delete(key);
  }

  seed(key: string, value: string): void {
    this.map.set(key, value);
  }

  read(key: string): string | null {
    return this.map.get(key) ?? null;
  }
}

function makeDurable(): DurableState {
  const snapshot = createDemoSnapshot(NOW);
  return {
    users: snapshot.users,
    household: snapshot.household,
    memberships: snapshot.memberships,
    tasks: snapshot.tasks,
    entries: snapshot.entries,
    currentUserId: snapshot.currentUserId,
    onboardingComplete: true,
    consent: {
      termsAccepted: true,
      termsVersion: 'demo-v1',
      acceptedAt: NOW.toISOString(),
      analyticsOptIn: false,
    },
  };
}

function toDurable(state: AppState): DurableState {
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

/* ------------------------------------------------------------------ */
/* Modification d'une tâche                                            */
/* ------------------------------------------------------------------ */

test('modifier une tâche change le descriptif courant sans toucher aux scores historiques', () => {
  const service = new DemoAppService();
  const state = createState();
  const dishes = requiredTask(state, 'task_dishes');
  const entriesBefore = state.entries;

  const plan = planUpdateTask(state, 'task_dishes', {
    name: '  Vaisselle\ndu soir ',
    category: 'dishes',
    weight: 9,
  });
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  const updated = service.updateTask({
    task: plan.value.task,
    name: plan.value.name,
    category: plan.value.category,
    weight: plan.value.weight,
  });
  assert.equal(updated.id, 'task_dishes');
  assert.equal(updated.name, 'Vaisselle du soir');
  assert.equal(updated.weight, 9);
  assert.equal(updated.active, true);
  assert.equal(updated.createdAt, dishes.createdAt);

  const next = reducer(state, { type: 'UPDATE_TASK', task: updated });
  assert.equal(next.notice, 'La tâche a été mise à jour.');
  assert.deepEqual(next.entries, entriesBefore); // aucun weightSnapshot ni score réécrit
  assert.equal(requiredTask(next, 'task_dishes').weight, 9);
});

test('la modification refuse une tâche inconnue et des champs invalides', () => {
  const state = createState();
  assert.deepEqual(planUpdateTask(state, 'task_disparue', { name: 'Ranger', category: 'other', weight: 2 }), {
    ok: false,
    error: 'Cette tâche n’existe plus.',
  });
  assert.equal(
    planUpdateTask(state, 'task_dishes', { name: ' A ', category: 'other', weight: 2 }).ok,
    false,
  );
  assert.equal(
    planUpdateTask(state, 'task_dishes', { name: 'Ranger', category: 'jardin' as never, weight: 2 }).ok,
    false,
  );
  assert.equal(
    planUpdateTask(state, 'task_dishes', { name: 'Ranger', category: 'other', weight: 1001 }).ok,
    false,
  );
});

test('en scénario gratuit, modifier une tâche conserve son poids existant au lieu de réécrire un champ non contrôlable', () => {
  const state = withPlan(createState(), 'free');
  const plan = planUpdateTask(state, 'task_dishes', { name: 'Vaisselle', category: 'dishes', weight: 500 });
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.equal(plan.value.weight, 2); // poids existant conservé, pas 1 ni 500
});

/* ------------------------------------------------------------------ */
/* Archivage réel                                                      */
/* ------------------------------------------------------------------ */

test('archiver une tâche la retire des propositions mais garde sa définition pour l’historique', () => {
  const state = createState();
  const plan = planArchiveTask(state, 'task_dishes');
  assert.equal(plan.ok, true);
  const next = reducer(state, { type: 'ARCHIVE_TASK', taskId: 'task_dishes' });
  assert.equal(next.notice, 'Tâche archivée : elle reste visible dans l’historique.');
  assert.equal(requiredTask(next, 'task_dishes').active, false);
  assert.deepEqual(selectActiveTasks(next.tasks).map((task) => task.id), [
    'task_cooking',
    'task_vacuum',
    'task_laundry',
    'task_bathroom',
  ]);

  const refused = planStartTimer(next, 'task_dishes');
  assert.deepEqual(refused, {
    ok: false,
    error: 'Cette tâche est archivée : elle reste consultable dans l’historique.',
  });
  const refusedManual = planManualEntry(next, 'task_dishes', 30);
  assert.deepEqual(refusedManual, {
    ok: false,
    error: 'Cette tâche est archivée : elle reste consultable dans l’historique.',
  });
});

test('archiver deux fois la même tâche est refusé, une tâche inconnue aussi', () => {
  let state = reducer(createState(), { type: 'ARCHIVE_TASK', taskId: 'task_dishes' });
  assert.deepEqual(planArchiveTask(state, 'task_dishes'), { ok: false, error: 'Cette tâche est déjà archivée.' });
  assert.deepEqual(planArchiveTask(state, 'task_disparue'), { ok: false, error: 'Cette tâche n’existe plus.' });

  // L'historique reste libellé avec le vrai nom après archivage (pas de repli cassé).
  const synthesis = buildHistorySynthesis(state.entries, state.tasks, true);
  const dishesRow = synthesis.byTask.find((row) => row.taskId === 'task_dishes');
  assert.ok(dishesRow !== undefined);
  assert.equal(dishesRow.label, 'Vaisselle');
});

/* ------------------------------------------------------------------ */
/* Correction d'une entrée terminée                                    */
/* ------------------------------------------------------------------ */

test('corriger une durée recalcule le score depuis le weightSnapshot figé, jamais le poids courant', () => {
  const service = new DemoAppService();
  let state = createState();
  // entrée_seed_1 : Noa, vaisselle, 18 min, weightSnapshot 2, score 36.
  const seed = state.entries.find((entry) => entry.id === 'entry_seed_1');
  assert.ok(seed !== undefined);
  assert.equal(seed.weightSnapshot, 2);
  assert.equal(seed.score, 36);

  // Le poids courant passe de 2 à 9 APRÈS la validation initiale.
  const updated = service.updateTask({
    task: requiredTask(state, 'task_dishes'),
    name: 'Vaisselle',
    category: 'dishes',
    weight: 9,
  });
  state = reducer(state, { type: 'UPDATE_TASK', task: updated });

  const plan = planEditEntryDuration(state, 'entry_seed_1', 50);
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  const corrected = service.editCompletedEntryDuration({
    entry: plan.value.entry,
    durationMinutes: plan.value.durationMinutes,
  });
  assert.equal(corrected.durationSeconds, 3000);
  assert.equal(corrected.score, 100); // (3000 / 60) × 2 (snapshot figé), pas × 9
  assert.equal(corrected.completedAt, seed.completedAt);
  assert.equal(corrected.startedAt, seed.startedAt);
  assert.equal(corrected.periodKey, seed.periodKey);
  assert.equal(corrected.isManual, seed.isManual);

  const next = reducer(state, { type: 'EDIT_ENTRY', entry: corrected });
  assert.equal(next.notice, 'Durée corrigée et score recalculé.');
  assert.equal(next.entries.find((entry) => entry.id === 'entry_seed_1')?.score, 100);
});

test('la correction refuse une durée invalide, une entrée inconnue, d’un autre membre ou encore en cours', () => {
  const base = createState();
  const running = runningEntry({ id: 'entry_other_run' });
  const state = { ...base, entries: [running, ...base.entries] };

  assert.equal(planEditEntryDuration(state, 'entry_seed_1', 0).ok, false);
  assert.equal(planEditEntryDuration(state, 'entry_seed_1', 12.5).ok, false);
  assert.equal(planEditEntryDuration(state, 'entry_seed_1', 1441).ok, false);
  assert.deepEqual(planEditEntryDuration(state, 'entry_inconnue', 30), {
    ok: false,
    error: 'Cette entrée ne peut pas être corrigée.',
  });
  // Une entrée terminée d'un autre membre n'est pas corrigeable par Noa.
  assert.deepEqual(planEditEntryDuration(state, 'entry_seed_2', 30), {
    ok: false,
    error: 'Cette entrée ne peut pas être corrigée.',
  });
  assert.deepEqual(planEditEntryDuration(state, 'entry_other_run', 30), {
    ok: false,
    error: 'Cette entrée ne peut pas être corrigée.',
  });
});

test('le service démo refuse de corriger un chrono actif', () => {
  const service = new DemoAppService();
  assert.throws(
    () => service.editCompletedEntryDuration({ entry: runningEntry(), durationMinutes: 30 }),
    /entrée terminée/,
  );
});

/* ------------------------------------------------------------------ */
/* Suppression confirmée d'une entrée                                  */
/* ------------------------------------------------------------------ */

test('supprimer une entrée ne laisse aucune orpheline dans classement, historique ou synthèse', () => {
  const state = createState();
  const seed = state.entries.find((entry) => entry.id === 'entry_seed_1');
  assert.ok(seed !== undefined);

  const plan = planDeleteEntry(state, 'entry_seed_1');
  assert.equal(plan.ok, true);
  const next = reducer(state, { type: 'DELETE_ENTRY', entryId: 'entry_seed_1' });
  assert.equal(next.notice, 'Entrée supprimée.');
  assert.equal(next.entries.some((entry) => entry.id === 'entry_seed_1'), false);

  const rowsBefore = buildLeaderboard(state.entries, state.users, state.memberships, state.household.id, 'week', NOW, true);
  const rowsAfter = buildLeaderboard(next.entries, next.users, next.memberships, next.household.id, 'week', NOW, true);
  const noaBefore = rowsBefore.find((row) => row.user.id === 'user_noa');
  const noaAfter = rowsAfter.find((row) => row.user.id === 'user_noa');
  assert.equal(noaAfter?.value, (noaBefore?.value ?? 0) - seed.score);
  assert.equal(noaAfter?.taskCount, (noaBefore?.taskCount ?? 0) - 1);
  assert.ok(rowsAfter.every((row) => Number.isFinite(row.value) && Number.isFinite(row.contribution)));

  const historyAfter = getVisibleHistory(next.entries, next.household.id, null, NOW);
  assert.equal(historyAfter.some((entry) => entry.id === 'entry_seed_1'), false);

  const synthesisAfter = buildHistorySynthesis(historyAfter, next.tasks, true);
  assert.equal(synthesisAfter.entryCount, historyAfter.length);
  assert.ok(synthesisAfter.byTask.every((row) => row.entryCount > 0));
});

test('la suppression refuse une entrée inconnue, d’un autre membre ou un chrono actif', () => {
  const base = createState();
  const state = { ...base, entries: [runningEntry({ id: 'entry_own_run' }), ...base.entries] };
  assert.deepEqual(planDeleteEntry(state, 'entry_inconnue'), {
    ok: false,
    error: 'Cette entrée ne peut pas être supprimée.',
  });
  assert.deepEqual(planDeleteEntry(state, 'entry_seed_2'), {
    ok: false,
    error: 'Cette entrée ne peut pas être supprimée.',
  });
  assert.deepEqual(planDeleteEntry(state, 'entry_own_run'), {
    ok: false,
    error: 'Cette entrée ne peut pas être supprimée.',
  });
});

test('supprimer toutes ses entrées rend visibles les états vides annoncés par les écrans', () => {
  const service = new DemoAppService();
  const base: AppState = { ...createState(), entries: [] };
  const dishes = requiredTask(base, 'task_dishes');
  let state = reducer(base, {
    type: 'ADD_ENTRY',
    entry: service.createManualEntry({
      householdId: base.household.id,
      userId: base.currentUserId,
      task: dishes,
      effectiveWeight: 2,
      durationMinutes: 10,
      now: new Date(NOW.getTime() - 5 * MINUTE_MS),
    }),
    eventCount: 0,
  });
  state = reducer(state, {
    type: 'ADD_ENTRY',
    entry: service.createManualEntry({
      householdId: base.household.id,
      userId: base.currentUserId,
      task: dishes,
      effectiveWeight: 2,
      durationMinutes: 15,
      now: new Date(NOW.getTime() - 3 * MINUTE_MS),
    }),
    eventCount: 0,
  });

  for (const entry of state.entries) {
    const plan = planDeleteEntry(state, entry.id);
    assert.equal(plan.ok, true);
    if (plan.ok) {
      state = reducer(state, { type: 'DELETE_ENTRY', entryId: plan.value });
    }
  }
  assert.equal(state.entries.length, 0);

  // Conditions exactes des états vides : historique vide, classement à zéro.
  const visible = getVisibleHistory(state.entries, state.household.id, null, NOW);
  assert.deepEqual(visible, []);
  const rows = buildLeaderboard(state.entries, state.users, state.memberships, state.household.id, 'week', NOW, true);
  assert.ok(rows.every((row) => row.taskCount === 0 && row.value === 0 && row.contribution === 0));
});

/* ------------------------------------------------------------------ */
/* Annulation d'un chrono actif                                        */
/* ------------------------------------------------------------------ */

test('annuler un chrono actif disparaît proprement et ne laisse aucune entrée fantôme', () => {
  const base = createState();
  const state = { ...base, entries: [runningEntry(), ...base.entries] };

  const plan = planCancelTimer(state, 'entry_running');
  assert.equal(plan.ok, true);
  const next = reducer(state, { type: 'CANCEL_TIMER', entryId: 'entry_running' });
  assert.equal(next.notice, 'Chrono annulé : aucune entrée créée.');
  assert.equal(next.entries.some((entry) => entry.id === 'entry_running'), false);

  // Cohérence avec applyRestartRules : plus aucune entrée en cours, donc
  // aucune reprise, expiration ou réparation à la relance suivante.
  const restart = applyRestartRules(next, new Date(NOW.getTime() + 48 * 60 * MINUTE_MS));
  assert.deepEqual(restart.events, []);
  assert.deepEqual(restart.snapshot, next);

  // Le chrono annulé n'est plus terminable.
  assert.deepEqual(planCompleteTimer(next, 'entry_running'), { ok: false, error: 'Ce chrono n’est pas disponible.' });
});

test('l’annulation refuse une entrée inconnue, terminée ou d’un autre membre', () => {
  const base = createState();
  const done = runningEntry({ id: 'entry_done', status: 'completed', completedAt: NOW.toISOString() });
  const otherRun = runningEntry({ id: 'entry_other', userId: 'user_camille' });
  const state = { ...base, entries: [done, otherRun, ...base.entries] };
  assert.deepEqual(planCancelTimer(state, 'entry_inconnue'), { ok: false, error: 'Ce chrono n’est pas disponible.' });
  assert.deepEqual(planCancelTimer(state, 'entry_done'), { ok: false, error: 'Ce chrono n’est pas disponible.' });
  assert.deepEqual(planCancelTimer(state, 'entry_other'), { ok: false, error: 'Ce chrono n’est pas disponible.' });
});

/* ------------------------------------------------------------------ */
/* Persistance après chaque mutation de contrôle                       */
/* ------------------------------------------------------------------ */

test('chaque mutation de contrôle est suivie d’une sauvegarde fidèle sans orpheline', async () => {
  const storage = new MemoryStorage();
  const service = new DemoAppService();
  let state = createState();

  await saveDurableState(storage, toDurable(state), NOW.toISOString());

  // 1. Modification de tâche.
  const updatePlan = planUpdateTask(state, 'task_dishes', { name: 'Vaisselle du soir', category: 'dishes', weight: 9 });
  assert.equal(updatePlan.ok, true);
  if (updatePlan.ok) {
    state = reducer(state, {
      type: 'UPDATE_TASK',
      task: service.updateTask({
        task: updatePlan.value.task,
        name: updatePlan.value.name,
        category: updatePlan.value.category,
        weight: updatePlan.value.weight,
      }),
    });
  }
  await saveDurableState(storage, toDurable(state), NOW.toISOString());
  let restored = await loadDurableState(storage);
  assert.equal(restored.status, 'restored');
  if (restored.status === 'restored') {
    assert.equal(restored.state.tasks.find((task) => task.id === 'task_dishes')?.name, 'Vaisselle du soir');
    assert.equal(restored.state.entries.find((entry) => entry.id === 'entry_seed_1')?.score, 36);
  }

  // 2. Archivage.
  state = reducer(state, { type: 'ARCHIVE_TASK', taskId: 'task_cooking' });
  await saveDurableState(storage, toDurable(state), NOW.toISOString());
  restored = await loadDurableState(storage);
  assert.equal(restored.status, 'restored');
  if (restored.status === 'restored') {
    assert.equal(restored.state.tasks.find((task) => task.id === 'task_cooking')?.active, false);
  }

  // 3. Correction d'une entrée terminée.
  const editPlan = planEditEntryDuration(state, 'entry_seed_1', 50);
  assert.equal(editPlan.ok, true);
  if (editPlan.ok) {
    state = reducer(state, {
      type: 'EDIT_ENTRY',
      entry: service.editCompletedEntryDuration({
        entry: editPlan.value.entry,
        durationMinutes: editPlan.value.durationMinutes,
      }),
    });
  }
  await saveDurableState(storage, toDurable(state), NOW.toISOString());
  restored = await loadDurableState(storage);
  assert.equal(restored.status, 'restored');
  if (restored.status === 'restored') {
    assert.equal(restored.state.entries.find((entry) => entry.id === 'entry_seed_1')?.score, 100);
  }

  // 4. Suppression confirmée.
  const deletePlan = planDeleteEntry(state, 'entry_seed_1');
  assert.equal(deletePlan.ok, true);
  if (deletePlan.ok) {
    state = reducer(state, { type: 'DELETE_ENTRY', entryId: deletePlan.value });
  }
  await saveDurableState(storage, toDurable(state), NOW.toISOString());
  restored = await loadDurableState(storage);
  assert.equal(restored.status, 'restored');
  if (restored.status === 'restored') {
    assert.equal(restored.state.entries.some((entry) => entry.id === 'entry_seed_1'), false);
    // Aucune orpheline dans le document persisté.
    const taskIds = new Set(restored.state.tasks.map((task) => task.id));
    const userIds = new Set(restored.state.users.map((user) => user.id));
    assert.ok(restored.state.entries.every((entry) => taskIds.has(entry.taskId) && userIds.has(entry.userId)));
  }

  // 5. Annulation d'un chrono actif.
  const started = service.startTimer({
    householdId: state.household.id,
    userId: state.currentUserId,
    task: requiredTask(state, 'task_vacuum'),
    effectiveWeight: 3,
    now: NOW,
  });
  state = reducer(state, { type: 'ADD_ENTRY', entry: started, eventCount: 0 });
  await saveDurableState(storage, toDurable(state), NOW.toISOString());
  restored = await loadDurableState(storage);
  assert.equal(restored.status, 'restored');

  const cancelPlan = planCancelTimer(state, started.id);
  assert.equal(cancelPlan.ok, true);
  if (cancelPlan.ok) {
    state = reducer(state, { type: 'CANCEL_TIMER', entryId: cancelPlan.value });
  }
  await saveDurableState(storage, toDurable(state), NOW.toISOString());
  restored = await loadDurableState(storage);
  assert.equal(restored.status, 'restored');
  if (restored.status === 'restored') {
    assert.equal(restored.state.entries.some((entry) => entry.id === started.id), false);
  }
});

/* ------------------------------------------------------------------ */
/* Validateur de persistance : intégrité référentielle et unicité       */
/* (constats MOB-CYCLE32857952394-F1/F2)                               */
/* ------------------------------------------------------------------ */

test('une entrée rattachée à une tâche inexistante rend le document refusé et quarantainé', async () => {
  const storage = new MemoryStorage();
  const durable = makeDurable();
  const orphaned: DurableState = {
    ...durable,
    entries: durable.entries.map((entry, index) =>
      index === 0 ? { ...entry, taskId: 'task_fantome' } : entry,
    ),
  };
  storage.seed(STORAGE_KEY, serializeEnvelope(orphaned, NOW.toISOString()));

  const outcome = await loadDurableState(storage);
  assert.deepEqual(outcome, { status: 'recovered', reason: 'invalid-shape', quarantined: true });
  assert.equal(parseEnvelope(serializeEnvelope(orphaned, NOW.toISOString())).outcome, 'invalid');
  assert.equal(storage.read(QUARANTINE_KEY), serializeEnvelope(orphaned, NOW.toISOString()));
});

test('une entrée rattachée à un utilisateur inexistant rend le document refusé', () => {
  const durable = makeDurable();
  const orphaned: DurableState = {
    ...durable,
    entries: durable.entries.map((entry, index) =>
      index === 0 ? { ...entry, userId: 'user_fantome' } : entry,
    ),
  };
  assert.equal(parseEnvelope(serializeEnvelope(orphaned, NOW.toISOString())).outcome, 'invalid');
});

test('un identifiant dupliqué dans une collection rend le document refusé', () => {
  const durable = makeDurable();
  const firstUser = durable.users[0];
  const firstTask = durable.tasks[0];
  const firstEntry = durable.entries[0];
  const firstMembership = durable.memberships[0];
  assert.ok(firstUser !== undefined);
  assert.ok(firstTask !== undefined);
  assert.ok(firstEntry !== undefined);
  assert.ok(firstMembership !== undefined);

  const duplicatedUsers: DurableState = {
    ...durable,
    users: [...durable.users, { ...firstUser }],
  };
  assert.equal(parseEnvelope(serializeEnvelope(duplicatedUsers, NOW.toISOString())).outcome, 'invalid');

  const duplicatedTasks: DurableState = {
    ...durable,
    tasks: [...durable.tasks, { ...firstTask }],
  };
  assert.equal(parseEnvelope(serializeEnvelope(duplicatedTasks, NOW.toISOString())).outcome, 'invalid');

  const duplicatedEntries: DurableState = {
    ...durable,
    entries: [...durable.entries, { ...firstEntry, taskId: 'task_bathroom' }],
  };
  assert.equal(parseEnvelope(serializeEnvelope(duplicatedEntries, NOW.toISOString())).outcome, 'invalid');

  // Les adhésions n'ont pas d'identifiant propre : la paire (foyer, membre)
  // fait office de clé naturelle et doit rester unique.
  const duplicatedMemberships: DurableState = {
    ...durable,
    memberships: [...durable.memberships, { ...firstMembership }],
  };
  assert.equal(parseEnvelope(serializeEnvelope(duplicatedMemberships, NOW.toISOString())).outcome, 'invalid');
});

test('le document valide de référence reste accepté par le validateur renforcé', () => {
  const durable = makeDurable();
  const parsed = parseEnvelope(serializeEnvelope(durable, NOW.toISOString()));
  assert.equal(parsed.outcome, 'valid');
});

/* ------------------------------------------------------------------ */
/* Frontière de production : échec fermé sur les nouvelles opérations   */
/* ------------------------------------------------------------------ */

test('l’adaptateur de production échoue fermé sur modification et correction', () => {
  const service = new ProductionAppService();
  const state = createState();
  const task = requiredTask(state, 'task_dishes');
  const entry = state.entries[0];
  assert.ok(entry !== undefined);
  assert.throws(() => service.updateTask({ task, name: 'X', category: 'other', weight: 1 }), ProductionModeDisabledError);
  assert.throws(
    () => service.editCompletedEntryDuration({ entry, durationMinutes: 30 }),
    ProductionModeDisabledError,
  );
});
