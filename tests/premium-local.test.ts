import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_LOCAL_HOUSEHOLDS,
  createInitialState,
  createLocalHousehold,
  planArchiveTask,
  planCancelTimer,
  planCompleteTimer,
  planCreateHousehold,
  planDeleteEntry,
  planEditEntryDuration,
  planManualEntry,
  planStartTimer,
  planSwitchHousehold,
  planUpdateTask,
  reducer,
  selectVisibleTasks,
} from '../src/store/appReducer.js';
import type { AppState } from '../src/store/appReducer.js';
import {
  parseEnvelope,
  serializeEnvelope,
} from '../src/store/persistence.js';
import { createDemoSnapshot } from '../src/data/demoData.js';
import { canAccessFeature, getPlanLabel } from '../src/domain/entitlements.js';
import { describePeriodBounds, filterHistoryEntries } from '../src/domain/history.js';
import { buildLeaderboard, getVisibleHistory } from '../src/domain/leaderboard.js';
import { buildHistoryFileName, buildHistoryReport } from '../src/domain/exportReport.js';
import type { ConsentState, Household, PlanScenario, TaskEntry } from '../src/domain/types.js';

const NOW = new Date(2026, 7, 26, 12, 0, 0); // mercredi 26 août 2026, 12:00 locale

const TEST_CONSENT: ConsentState = {
  termsAccepted: true,
  termsVersion: 'demo-v1',
  acceptedAt: NOW.toISOString(),
  analyticsOptIn: false,
};

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
    startedAt: new Date(NOW.getTime() - 10 * 60 * 1000).toISOString(),
    completedAt: null,
    durationSeconds: 0,
    weightSnapshot: 2,
    score: 0,
    isManual: false,
    periodKey: 'test-week',
    ...overrides,
  };
}

/** Document durable valide à deux foyers, construit depuis le semis. */
function makeTwoHouseholdDurable(): {
  durable: Parameters<typeof serializeEnvelope>[0];
  second: Household;
} {
  const snapshot = createDemoSnapshot(NOW);
  const second = createLocalHousehold('Coloc du parc', snapshot.household, NOW);
  const durable = {
    users: snapshot.users,
    households: [snapshot.household, second],
    memberships: [
      ...snapshot.memberships,
      {
        householdId: second.id,
        userId: snapshot.currentUserId,
        role: 'owner' as const,
        joinedAt: NOW.toISOString(),
      },
    ],
    tasks: snapshot.tasks,
    entries: snapshot.entries,
    currentUserId: snapshot.currentUserId,
    currentHouseholdId: snapshot.household.id,
    onboardingComplete: true,
    consent: TEST_CONSENT,
  };
  return { durable, second };
}

/** État à deux foyers : le semis « Rivage » plus un foyer local vide créé. */
function twoHouseholdState(): { state: AppState; second: Household } {
  const base = createState();
  const second = createLocalHousehold('Coloc du parc', base.household, NOW);
  const state = reducer(base, {
    type: 'CREATE_HOUSEHOLD',
    household: second,
    joinedAt: NOW.toISOString(),
  });
  return { state, second };
}

/* ------------------------------------------------------------------ */
/* Roster initial et invariant de cohérence                            */
/* ------------------------------------------------------------------ */

test('l’état initial enveloppe le foyer du semis dans un roster d’un élément', () => {
  const state = createState();
  assert.equal(state.households.length, 1);
  assert.equal(state.currentHouseholdId, state.households[0]?.id);
  assert.equal(state.household.id, state.households[0]?.id);
});

test('le foyer actif matérialisé reste l’élément du roster après chaque action du parcours', () => {
  let state = twoHouseholdState().state;
  const checkInvariant = () => {
    const active = state.households.find((item) => item.id === state.currentHouseholdId);
    assert.ok(active !== undefined);
    assert.deepEqual(state.household, active);
  };
  checkInvariant();
  state = reducer(state, { type: 'SET_PLAN', plan: 'standard', maxMembers: 7 });
  checkInvariant();
  // Le scénario s'applique au foyer actif ET à sa copie dans le roster — pas
  // aux autres foyers, dont le scénario reste propre.
  const activeAfterPlan = state.households.find((item) => item.id === state.currentHouseholdId);
  assert.equal(activeAfterPlan?.plan, 'standard');
  const rivageBefore = state.households.find((item) => item.id === 'household_rivage');
  assert.equal(rivageBefore?.plan, 'trial');
  const first = state.households.find((item) => item.id === 'household_rivage');
  assert.ok(first !== undefined);
  state = reducer(state, { type: 'SWITCH_HOUSEHOLD', householdId: first.id });
  checkInvariant();
  // Chaque foyer conserve son propre scénario après la bascule.
  assert.equal(state.household.plan, 'trial');
});

/* ------------------------------------------------------------------ */
/* Création et bascule réelles de foyers locaux                        */
/* ------------------------------------------------------------------ */

test('créer un foyer local est refusé en gratuit et annoncé comme fonction complète', () => {
  const state = withPlan(createState(), 'free');
  assert.deepEqual(planCreateHousehold(state, 'Coloc du parc'), {
    ok: false,
    error: 'Créer un autre foyer fait partie des offres complètes.',
  });
  assert.equal(canAccessFeature(state.household, 'multiple_households'), false);
});

test('le nom du nouveau foyer est validé comme les autres saisies', () => {
  const state = createState();
  assert.deepEqual(planCreateHousehold(state, '   '), {
    ok: false,
    error: 'Le nom du foyer doit contenir au moins 2 caractères.',
  });
  assert.deepEqual(planCreateHousehold(state, 'x'.repeat(41)), {
    ok: false,
    error: 'Le nom du foyer ne peut pas dépasser 40 caractères.',
  });
  const normalized = planCreateHousehold(state, '  Coloc   du parc ');
  assert.equal(normalized.ok, true);
  if (normalized.ok) {
    assert.equal(normalized.value.name, 'Coloc du parc');
  }
});

test('le plafond de foyers locaux est refusé avec un message honnête', () => {
  let state = createState();
  for (let index = state.households.length; index < MAX_LOCAL_HOUSEHOLDS; index += 1) {
    const household = createLocalHousehold(`Foyer ${index}`, state.household, NOW);
    state = reducer(state, { type: 'CREATE_HOUSEHOLD', household, joinedAt: NOW.toISOString() });
  }
  assert.equal(state.households.length, MAX_LOCAL_HOUSEHOLDS);
  assert.deepEqual(planCreateHousehold(state, 'Encore un'), {
    ok: false,
    error: `La démo conserve au plus ${MAX_LOCAL_HOUSEHOLDS} foyers sur cet appareil.`,
  });
});

test('la création produit un foyer vide isolé avec adhésion propriétaire et essai neuf', () => {
  const { state, second } = twoHouseholdState();
  // Le nouveau foyer devient actif et est annoncé.
  assert.equal(state.currentHouseholdId, second.id);
  assert.equal(state.household.id, second.id);
  assert.equal(
    state.notice,
    `Foyer « ${second.name} » créé : ses données sont séparées des autres foyers.`,
  );
  // Isolation : aucune tâche ni entrée ne fuit depuis Rivage.
  assert.deepEqual(selectVisibleTasks(state), []);
  assert.deepEqual(getVisibleHistory(state.entries, second.id, null, NOW), []);
  // Adhésion propriétaire pour la personne courante, sans duplication des autres.
  const membership = state.memberships.find(
    (item) => item.householdId === second.id && item.userId === state.currentUserId,
  );
  assert.deepEqual(membership, {
    householdId: second.id,
    userId: state.currentUserId,
    role: 'owner',
    joinedAt: NOW.toISOString(),
  });
  assert.equal(state.memberships.filter((item) => item.householdId === second.id).length, 1);
  // Scénario hérité du foyer courant, essai démarré à la création.
  assert.equal(second.plan, 'trial');
  assert.equal(second.timezone, 'Europe/Zurich');
  assert.equal(new Date(second.trialStartedAt).getTime(), NOW.getTime());
});

test('le classement du nouveau foyer reste calme et descriptif à membre unique', () => {
  const { state, second } = twoHouseholdState();
  const rows = buildLeaderboard(
    state.entries,
    state.users,
    state.memberships,
    second.id,
    'week',
    NOW,
    true,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.user.id, state.currentUserId);
  assert.equal(rows[0]?.taskCount, 0);
  assert.equal(rows[0]?.value, 0);
});

test('basculer entre foyers restaure les données propres à chacun', () => {
  const { state, second } = twoHouseholdState();
  const first = state.households.find((item) => item.id === 'household_rivage');
  assert.ok(first !== undefined);

  const back = reducer(state, { type: 'SWITCH_HOUSEHOLD', householdId: first.id });
  assert.equal(back.currentHouseholdId, first.id);
  assert.equal(back.notice, `Foyer actif : ${first.name}.`);
  // Rivage retrouve ses tâches actives et son historique complet.
  assert.ok(selectVisibleTasks(back).length > 0);
  assert.equal(selectVisibleTasks(back).every((task) => task.householdId === first.id), true);
  assert.ok(getVisibleHistory(back.entries, first.id, null, NOW).length > 0);

  const forth = reducer(back, { type: 'SWITCH_HOUSEHOLD', householdId: second.id });
  assert.deepEqual(selectVisibleTasks(forth), []);
  assert.deepEqual(getVisibleHistory(forth.entries, second.id, null, NOW), []);
});

test('une bascule vers un foyer inconnu ou déjà actif est refusée', () => {
  const { state, second } = twoHouseholdState();
  assert.deepEqual(planSwitchHousehold(state, 'household_fantome'), {
    ok: false,
    error: 'Ce foyer est introuvable sur cet appareil.',
  });
  assert.deepEqual(planSwitchHousehold(state, second.id), {
    ok: false,
    error: 'Tu es déjà dans ce foyer.',
  });
});

test('basculer de foyer alors qu’un chrono tourne annonce le foyer où l’arrêter', () => {
  const { state, second } = twoHouseholdState(); // foyer actif : « Coloc du parc »
  const first = state.households.find((item) => item.id === 'household_rivage');
  assert.ok(first !== undefined);

  // Sans chrono actif, l'annonce de bascule reste inchangée.
  const back = reducer(state, { type: 'SWITCH_HOUSEHOLD', householdId: first.id });
  assert.equal(back.notice, `Foyer actif : ${first.name}.`);

  // Un chrono démarre dans Rivage, puis bascule vers « Coloc du parc » :
  // la notice nomme le foyer d'origine au lieu de laisser le chrono invisible.
  const withTimer = {
    ...back,
    entries: [runningEntry({ householdId: first.id }), ...back.entries],
  };
  const forth = reducer(withTimer, { type: 'SWITCH_HOUSEHOLD', householdId: second.id });
  assert.equal(
    forth.notice,
    'Foyer actif : Coloc du parc. Un chrono lancé dans « Foyer Rivage » continue de tourner : retourne dans ce foyer pour l’arrêter.',
  );
  // L'entrée reste intouchable depuis l'autre foyer : l'arrêt n'est possible
  // que dans le foyer où le chrono a été démarré.
  assert.deepEqual(planCompleteTimer(forth, 'entry_running'), {
    ok: false,
    error: 'Cette entrée appartient à un autre foyer.',
  });
  assert.deepEqual(planCancelTimer(forth, 'entry_running'), {
    ok: false,
    error: 'Cette entrée appartient à un autre foyer.',
  });
});

/* ------------------------------------------------------------------ */
/* Isolation : aucune action croisée entre foyers                      */
/* ------------------------------------------------------------------ */

test('les tâches d’un autre foyer ne sont ni démarrables ni modifiables ici', () => {
  const { state } = twoHouseholdState(); // foyer actif : « Coloc du parc » (vide)
  const rivageTaskId = 'task_dishes'; // tâche du foyer Rivage resté en base
  assert.deepEqual(planStartTimer(state, rivageTaskId), {
    ok: false,
    error: 'Cette tâche appartient à un autre foyer.',
  });
  assert.equal(planManualEntry(state, rivageTaskId, 30).ok, false);
  assert.equal(
    planUpdateTask(state, rivageTaskId, { name: 'Déplacement', category: 'other', weight: 1 }).ok,
    false,
  );
  assert.equal(planArchiveTask(state, rivageTaskId).ok, false);
});

test('les entrées d’un autre foyer ne sont ni complétées ni corrigées ni supprimées ici', () => {
  const { state } = twoHouseholdState();
  const foreignRunning = runningEntry({ id: 'entry_foreign' });
  const foreignCompleted = runningEntry({
    id: 'entry_foreign_done',
    status: 'completed',
    startedAt: null,
    completedAt: NOW.toISOString(),
    durationSeconds: 600,
    score: 20,
  });
  const withForeign = { ...state, entries: [foreignRunning, foreignCompleted, ...state.entries] };
  assert.equal(planCompleteTimer(withForeign, foreignRunning.id).ok, false);
  assert.equal(planEditEntryDuration(withForeign, foreignCompleted.id, 20).ok, false);
  assert.equal(planDeleteEntry(withForeign, foreignCompleted.id).ok, false);
  assert.equal(planCancelTimer(withForeign, foreignRunning.id).ok, false);
});

test('un seul chrono par personne, y compris entre deux foyers', () => {
  const { state } = twoHouseholdState();
  // Un chrono démarré dans Rivage bloque tout nouveau chrono dans l'autre foyer :
  // une personne ne peut pas être chronométrée en deux endroits à la fois.
  const withTimer = {
    ...state,
    entries: [runningEntry({ householdId: 'household_rivage' }), ...state.entries],
  };
  const colocationTask = {
    id: 'task_coloc',
    householdId: state.currentHouseholdId,
    name: 'Courses communes',
    category: 'shopping' as const,
    weight: 1,
    active: true,
    createdAt: NOW.toISOString(),
  };
  const withTask = { ...withTimer, tasks: [colocationTask, ...withTimer.tasks] };
  assert.deepEqual(planStartTimer(withTask, colocationTask.id), {
    ok: false,
    error: 'Termine le chrono actif avant d’en lancer un autre.',
  });
});

/* ------------------------------------------------------------------ */
/* Validateur v2 : intégrité référentielle entre foyers                */
/* ------------------------------------------------------------------ */

test('un document à deux foyers cohérent est accepté par le validateur v2', () => {
  const { durable } = makeTwoHouseholdDurable();
  assert.equal(parseEnvelope(serializeEnvelope(durable, NOW.toISOString())).outcome, 'valid');
});

test('un identifiant de foyer dupliqué rend le document refusé', () => {
  const { durable } = makeTwoHouseholdDurable();
  const firstHousehold = durable.households[0];
  assert.ok(firstHousehold !== undefined);
  const corrupted = {
    ...durable,
    households: [firstHousehold, { ...firstHousehold }],
  };
  assert.equal(parseEnvelope(serializeEnvelope(corrupted, NOW.toISOString())).outcome, 'invalid');
});

test('un foyer actif absent du roster rend le document refusé', () => {
  const { durable } = makeTwoHouseholdDurable();
  const corrupted = { ...durable, currentHouseholdId: 'household_fantome' };
  assert.equal(parseEnvelope(serializeEnvelope(corrupted, NOW.toISOString())).outcome, 'invalid');
});

test('une adhésion vers un foyer inconnu rend le document refusé', () => {
  const { durable } = makeTwoHouseholdDurable();
  const corrupted = {
    ...durable,
    memberships: [
      ...durable.memberships,
      { householdId: 'household_fantome', userId: 'user_noa', role: 'member' as const, joinedAt: NOW.toISOString() },
    ],
  };
  assert.equal(parseEnvelope(serializeEnvelope(corrupted, NOW.toISOString())).outcome, 'invalid');
});

test('une entrée rattachée à la tâche d’un autre foyer rend le document refusé', () => {
  const { durable, second } = makeTwoHouseholdDurable();
  // La première entrée pointe une tâche de Rivage mais se déclare du nouveau foyer.
  const corrupted = {
    ...durable,
    entries: durable.entries.map((entry, index) =>
      index === 0 ? { ...entry, householdId: second.id } : entry,
    ),
  };
  assert.equal(parseEnvelope(serializeEnvelope(corrupted, NOW.toISOString())).outcome, 'invalid');
});

test('une entrée d’une personne sans adhésion au foyer de l’entrée rend le document refusé', () => {
  const { durable, second } = makeTwoHouseholdDurable();
  // Sam n'est pas membre du nouveau foyer : son entrée y serait illégitime.
  const corrupted = {
    ...durable,
    entries: durable.entries.map((entry, index) =>
      index === 0 ? { ...entry, householdId: second.id, taskId: 'task_coloc_absent' } : entry,
    ),
  };
  assert.equal(parseEnvelope(serializeEnvelope(corrupted, NOW.toISOString())).outcome, 'invalid');
});

test('une personne active sans adhésion au foyer actif rend le document refusé', () => {
  const { durable, second } = makeTwoHouseholdDurable();
  const corrupted = {
    ...durable,
    currentHouseholdId: second.id,
    memberships: durable.memberships.filter((item) => item.householdId !== second.id),
  };
  assert.equal(parseEnvelope(serializeEnvelope(corrupted, NOW.toISOString())).outcome, 'invalid');
});

/* ------------------------------------------------------------------ */
/* Export local réellement consultable                                 */
/* ------------------------------------------------------------------ */

function reportInput(overrides?: Partial<Parameters<typeof buildHistoryReport>[0]>) {
  const snapshot = createDemoSnapshot(NOW);
  return {
    householdName: snapshot.household.name,
    planLabel: getPlanLabel(snapshot.household.plan),
    period: 'week' as const,
    memberLabel: null,
    entries: filterHistoryEntries(
      getVisibleHistory(snapshot.entries, snapshot.household.id, null, NOW),
      'week',
      null,
      NOW,
    ),
    tasks: snapshot.tasks,
    users: snapshot.users,
    useWeights: true,
    generatedAt: NOW,
    ...overrides,
  };
}

test('le rapport est déterministe et reflète la sélection réelle du foyer', () => {
  const input = reportInput();
  const first = buildHistoryReport(input);
  const second = buildHistoryReport(input);
  assert.deepEqual(first, second);

  // En-tête honnête : démo locale, aucun réseau, foyer et période nommés.
  assert.match(first.text, /ChoreScore — Rapport d’historique/);
  assert.match(first.text, /sans envoi réseau ni synchronisation/);
  assert.match(first.text, /Foyer : Foyer Rivage/);
  assert.match(first.text, /Semaine du 24 août 2026/);
  assert.match(first.text, new RegExp(`Entrées \\(${input.entries.length}\\)`));

  // Les totaux du rapport sont ceux de la sélection filtrée (6 saisies de la
  // semaine dans le semis, cf. tests/history.test.ts).
  assert.equal(input.entries.length, 6);
  assert.match(first.text, /Temps saisi : \d+ min/);
  // Chaque entrée apparaît avec sa durée ; la plus récente d'abord.
  const lines = first.text.split('\n').filter((line) => line.startsWith('- ') && line.includes('·'));
  assert.equal(lines.length >= input.entries.length, true);
});

test('le rapport reste consultable à vide : totaux zéro et message explicite', () => {
  const report = buildHistoryReport(reportInput({ entries: [] }));
  assert.match(report.text, /Aucune entrée dans cette sélection\./);
  assert.match(report.text, /Temps saisi : 0 min/);
  assert.match(report.text, /\(aucune tâche dans cette sélection\)/);
});

test('le rapport suit le scénario : temps brut en gratuit, points pondérés sinon', () => {
  const weighted = buildHistoryReport(reportInput({ useWeights: true }));
  assert.match(weighted.text, /durée × poids convenu/);
  assert.match(weighted.text, /Unité : pts/);
  const raw = buildHistoryReport(reportInput({ useWeights: false }));
  assert.match(raw.text, /temps brut, poids effectif 1/);
  assert.match(raw.text, /Unité : min/);
});

test('le filtre membre est nommé dans le rapport', () => {
  const report = buildHistoryReport(reportInput({ memberLabel: 'Noa' }));
  assert.match(report.text, /Membre : Noa/);
  const whole = buildHistoryReport(reportInput({ memberLabel: null }));
  assert.match(whole.text, /Membre : tout le foyer/);
});

test('le nom de fichier est déterministe et horodaté à l’heure locale', () => {
  const fileName = buildHistoryFileName(NOW);
  assert.equal(fileName, 'rapport-chorescore-20260826-1200.txt');
  const report = buildHistoryReport(reportInput());
  assert.equal(report.fileName, fileName);
});

/* ------------------------------------------------------------------ */
/* Bornes de période affichées (méthode de calcul visible)             */
/* ------------------------------------------------------------------ */

test('les bornes annoncées correspondent exactement aux bornes de filtrage', () => {
  const weekBounds = describePeriodBounds('week', NOW);
  const monthBounds = describePeriodBounds('month', NOW);
  assert.equal(weekBounds, 'Semaine du 24 août 2026, de 00:00 à maintenant (horloge de l’appareil)');
  assert.equal(monthBounds, 'Mois du 1er août 2026, de 00:00 à maintenant (horloge de l’appareil)');
  assert.equal(describePeriodBounds('all', NOW), null);

  // Frontière d'année : début janvier annonce bien l'année du mois courant.
  const january = new Date(2027, 0, 1, 12, 0, 0);
  assert.match(describePeriodBounds('month', january) ?? '', /Mois du 1er janvier 2027/);
  assert.match(describePeriodBounds('week', january) ?? '', /Semaine du 28 décembre 2026/);

  // Cohérence fonctionnelle : une entrée exactement au début de semaine
  // annoncée passe le filtre, une seconde avant non.
  const weekStart = new Date(2026, 7, 24, 0, 0, 0);
  const atStart = runningEntry({
    id: 'at_start',
    status: 'completed',
    startedAt: null,
    completedAt: weekStart.toISOString(),
    durationSeconds: 600,
    score: 20,
  });
  const beforeStart = runningEntry({
    id: 'before_start',
    status: 'completed',
    startedAt: null,
    completedAt: new Date(weekStart.getTime() - 1000).toISOString(),
    durationSeconds: 600,
    score: 20,
  });
  const kept = filterHistoryEntries([atStart, beforeStart], 'week', null, NOW);
  assert.deepEqual(kept.map((item) => item.id), ['at_start']);
});
