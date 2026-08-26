import assert from 'node:assert/strict';
import test from 'node:test';
import type { KeyValueStorage } from '../src/store/persistence.js';
import {
  MAX_SERIALIZED_BYTES,
  QUARANTINE_KEY,
  SCHEMA_VERSION,
  STORAGE_KEY,
  createSequentialWriter,
  isDurableState,
  isLegacyDurableStateV1,
  loadDurableState,
  migrateV1ToV2,
  parseEnvelope,
  saveDurableState,
  serializeEnvelope,
  serializeStable,
  utf8ByteLength,
} from '../src/store/persistence.js';
import { createLoadingState, reducer } from '../src/store/appReducer.js';
import { applyRestartRules } from '../src/domain/timerRules.js';
import { createDemoSnapshot } from '../src/data/demoData.js';
import type { ConsentState, TaskEntry } from '../src/domain/types.js';
import type { DurableState, LegacyDurableStateV1 } from '../src/store/persistence.js';

const NOW = new Date(2026, 7, 26, 12, 0, 0);
const HOUR_SECONDS = 60 * 60;

class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  private pendingWrites = 0;
  failGet = false;
  failSet = false;
  setDelayMs = 0;
  calls: string[] = [];

  async getItem(key: string): Promise<string | null> {
    this.calls.push(`get:${key}`);
    if (this.failGet) {
      throw new Error('stockage verrouillé');
    }
    return this.map.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.calls.push(`set:${key}`);
    if (this.failSet) {
      throw new Error('stockage saturé');
    }
    this.pendingWrites += 1;
    try {
      if (this.setDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.setDelayMs));
      }
      this.map.set(key, value);
    } finally {
      this.pendingWrites -= 1;
    }
  }

  async removeItem(key: string): Promise<void> {
    this.calls.push(`del:${key}`);
    this.map.delete(key);
  }

  seed(key: string, value: string): void {
    this.map.set(key, value);
  }

  read(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  get hasPendingWrites(): boolean {
    return this.pendingWrites > 0;
  }
}

const TEST_CONSENT: ConsentState = {
  termsAccepted: true,
  termsVersion: 'demo-v1',
  acceptedAt: NOW.toISOString(),
  analyticsOptIn: false,
};

function makeDurable(): DurableState {
  const snapshot = createDemoSnapshot(NOW);
  return {
    users: snapshot.users,
    households: [snapshot.household],
    memberships: snapshot.memberships,
    tasks: snapshot.tasks,
    entries: snapshot.entries,
    currentUserId: snapshot.currentUserId,
    currentHouseholdId: snapshot.household.id,
    onboardingComplete: true,
    consent: TEST_CONSENT,
  };
}

/** Forme historique v1 (foyer unique), construite depuis le semis de démo. */
function makeLegacyV1(): LegacyDurableStateV1 {
  const snapshot = createDemoSnapshot(NOW);
  return {
    users: snapshot.users,
    household: snapshot.household,
    memberships: snapshot.memberships,
    tasks: snapshot.tasks,
    entries: snapshot.entries,
    currentUserId: snapshot.currentUserId,
    onboardingComplete: true,
    consent: TEST_CONSENT,
  };
}

function runningEntry(startedAtIso: string | null, overrides?: Partial<TaskEntry>): TaskEntry {
  return {
    id: 'entry_running',
    taskId: 'task_dishes',
    householdId: 'household_rivage',
    userId: 'user_noa',
    status: 'in_progress',
    startedAt: startedAtIso,
    completedAt: null,
    durationSeconds: 0,
    weightSnapshot: 2,
    score: 0,
    isManual: false,
    periodKey: '2026-W35',
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* Hydratation : premier lancement et restauration                     */
/* ------------------------------------------------------------------ */

test('premier lancement : un stockage vide produit une issue first-launch sans données', async () => {
  const storage = new MemoryStorage();
  const outcome = await loadDurableState(storage);
  assert.deepEqual(outcome, { status: 'first-launch' });
});

test('l’état de chargement ne contient aucune donnée fictive (pas de flash demoData)', () => {
  const loading = createLoadingState();
  assert.equal(loading.hydration.phase, 'loading');
  assert.equal(loading.users.length, 0);
  assert.equal(loading.tasks.length, 0);
  assert.equal(loading.entries.length, 0);
  assert.equal(loading.currentUserId, '');
});

test('HYDRATION_READY remplace l’état vide par les données restaurées et passe en prêt', () => {
  const snapshot = createDemoSnapshot(NOW);
  const next = reducer(createLoadingState(), {
    type: 'HYDRATION_READY',
    snapshot,
    roster: { households: [snapshot.household], currentHouseholdId: snapshot.household.id },
    durable: { onboardingComplete: true, consent: TEST_CONSENT },
    notice: null,
  });
  assert.equal(next.hydration.phase, 'ready');
  assert.deepEqual(next.tasks, snapshot.tasks);
  assert.deepEqual(next.entries, snapshot.entries);
  assert.equal(next.onboardingComplete, true);
  assert.deepEqual(next.consent, TEST_CONSENT);
  assert.equal(next.currentHouseholdId, snapshot.household.id);
  assert.deepEqual(next.households, [snapshot.household]);
});

test('une relance restaure exactement l’état stocké, y compris consentement et onboarding', async () => {
  const storage = new MemoryStorage();
  const durable = makeDurable();
  const savedAt = NOW.toISOString();
  storage.seed(STORAGE_KEY, serializeEnvelope(durable, savedAt));

  const outcome = await loadDurableState(storage);
  assert.equal(outcome.status, 'restored');
  if (outcome.status !== 'restored') return;
  assert.equal(outcome.savedAt, savedAt);
  assert.deepEqual(outcome.state, durable);
  assert.equal(outcome.state.onboardingComplete, true);
  assert.deepEqual(outcome.state.consent, TEST_CONSENT);
});

/* ------------------------------------------------------------------ */
/* Migration undefined -> v1 et enveloppe                              */
/* ------------------------------------------------------------------ */

test('la migration undefined -> v2 écrit une enveloppe schemaVersion 2 relisible', async () => {
  const storage = new MemoryStorage();
  // Premier lancement : aucune donnée, puis première sauvegarde métier.
  assert.deepEqual(await loadDurableState(storage), { status: 'first-launch' });
  const durable = makeDurable();
  const save = await saveDurableState(storage, durable, NOW.toISOString());
  assert.equal(save.ok, true);

  const raw = storage.read(STORAGE_KEY);
  assert.ok(raw !== null);
  const parsed = parseEnvelope(raw);
  assert.equal(parsed.outcome, 'valid');
  if (parsed.outcome !== 'valid') return;
  assert.equal(parsed.envelope.schemaVersion, SCHEMA_VERSION);
  assert.equal(SCHEMA_VERSION, 2);
  assert.equal(parsed.migratedFrom, undefined);
  assert.deepEqual(parsed.envelope.state, durable);

  const reloaded = await loadDurableState(storage);
  assert.equal(reloaded.status, 'restored');
});

test('un document v1 (foyer unique) migre explicitement vers v2 sans perte', async () => {
  const storage = new MemoryStorage();
  const legacy = makeLegacyV1();
  const legacyRaw = JSON.stringify({
    schemaVersion: 1,
    savedAt: NOW.toISOString(),
    state: legacy,
  });
  storage.seed(STORAGE_KEY, legacyRaw);

  const outcome = await loadDurableState(storage);
  assert.equal(outcome.status, 'restored');
  if (outcome.status !== 'restored') return;
  assert.equal(outcome.migratedFrom, 1);
  // Le foyer unique devient une collection d'un élément et le foyer actif est
  // identifié ; toutes les données métier sont conservées à l'identique.
  assert.deepEqual(outcome.state.households, [legacy.household]);
  assert.equal(outcome.state.currentHouseholdId, legacy.household.id);
  assert.deepEqual(outcome.state.users, legacy.users);
  assert.deepEqual(outcome.state.memberships, legacy.memberships);
  assert.deepEqual(outcome.state.tasks, legacy.tasks);
  assert.deepEqual(outcome.state.entries, legacy.entries);
  assert.equal(outcome.state.currentUserId, legacy.currentUserId);
  assert.equal(outcome.state.onboardingComplete, true);
  assert.deepEqual(outcome.state.consent, TEST_CONSENT);
  assert.equal(Object.hasOwn(outcome.state, 'household'), false);
});

test('la fonction de migration est pure : v1 -> v2 sans mutation de l’entrée', () => {
  const legacy = makeLegacyV1();
  const migrated = migrateV1ToV2(legacy);
  assert.deepEqual(migrated.households, [legacy.household]);
  assert.equal(migrated.currentHouseholdId, legacy.household.id);
  assert.equal(isLegacyDurableStateV1(legacy), true);
});

test('une charge v1 de forme invalide n’est pas migrée : elle reste refusée', () => {
  const broken = JSON.stringify({
    schemaVersion: 1,
    savedAt: NOW.toISOString(),
    state: { users: [], household: null },
  });
  assert.equal(parseEnvelope(broken).outcome, 'invalid');
});

/**
 * Document v1 conforme à la forme legacy (contrôlée par
 * `isLegacyDurableStateV1`), dérivé du semis de démonstration.
 */
function makeLegacyV1Raw(overrides?: Partial<LegacyDurableStateV1>): {
  raw: string;
  legacy: LegacyDurableStateV1;
} {
  const legacy: LegacyDurableStateV1 = { ...makeLegacyV1(), ...overrides };
  return {
    legacy,
    raw: JSON.stringify({ schemaVersion: 1, savedAt: NOW.toISOString(), state: legacy }),
  };
}

test('une charge v1 valide dont une entrée pointe un foyer inconnu est refusée, pas migrée', () => {
  const { legacy, raw } = makeLegacyV1Raw({
    entries: makeLegacyV1().entries.map((entry, index) =>
      index === 0 ? { ...entry, householdId: 'household_ghost' } : entry,
    ),
  });
  // La forme v1 reste valide : le validateur d'origine ne contrôle pas le
  // rattachement des entrées à un foyer connu.
  assert.equal(isLegacyDurableStateV1(legacy), true);
  // Mais l'état migré viole le schéma v2 : la charge est refusée d'emblée au
  // lieu d'être chargée puis re-persistée en v2 condamné à la quarantaine.
  assert.deepEqual(parseEnvelope(raw), { outcome: 'invalid', reason: 'invalid-shape' });
});

test('une adhésion v1 vers un utilisateur ou un foyer inconnu rend la migration refusée', () => {
  const unknownUser = makeLegacyV1Raw({
    memberships: [
      ...makeLegacyV1().memberships,
      {
        householdId: 'household_rivage',
        userId: 'user_ghost',
        role: 'member',
        joinedAt: NOW.toISOString(),
      },
    ],
  });
  assert.equal(isLegacyDurableStateV1(unknownUser.legacy), true);
  assert.deepEqual(parseEnvelope(unknownUser.raw), { outcome: 'invalid', reason: 'invalid-shape' });

  const unknownHousehold = makeLegacyV1Raw({
    memberships: [
      ...makeLegacyV1().memberships,
      {
        householdId: 'household_ghost',
        userId: 'user_noa',
        role: 'member',
        joinedAt: NOW.toISOString(),
      },
    ],
  });
  assert.equal(isLegacyDurableStateV1(unknownHousehold.legacy), true);
  assert.deepEqual(parseEnvelope(unknownHousehold.raw), {
    outcome: 'invalid',
    reason: 'invalid-shape',
  });
});

test('un utilisateur actif sans adhésion au foyer actif rend la migration v1 refusée', () => {
  const { legacy, raw } = makeLegacyV1Raw({
    entries: [],
    memberships: makeLegacyV1().memberships.filter(
      (membership) => membership.userId !== 'user_noa',
    ),
  });
  assert.equal(isLegacyDurableStateV1(legacy), true);
  assert.deepEqual(parseEnvelope(raw), { outcome: 'invalid', reason: 'invalid-shape' });
});

test('la charge v1 incohérente part en quarantaine visible dès la première lecture', async () => {
  const storage = new MemoryStorage();
  const { raw } = makeLegacyV1Raw({
    entries: makeLegacyV1().entries.map((entry, index) =>
      index === 0 ? { ...entry, householdId: 'household_ghost' } : entry,
    ),
  });
  storage.seed(STORAGE_KEY, raw);

  // Aucun état que le validateur v2 refuse n'est chargé ni re-persisté :
  // le document part en quarantaine à la première lecture, pas à la suivante.
  const outcome = await loadDurableState(storage);
  assert.deepEqual(outcome, { status: 'recovered', reason: 'invalid-shape', quarantined: true });
  assert.equal(storage.read(STORAGE_KEY), null);
  assert.equal(storage.read(QUARANTINE_KEY), raw);
});

test('non-régression : tout état migré depuis un document v1 cohérent satisfait le validateur v2', () => {
  const legacy = makeLegacyV1();
  const migrated = migrateV1ToV2(legacy);
  // Les documents réellement écrits par l'application (référentiellement
  // cohérents) continuent de migrer sans perte vers une enveloppe valide.
  assert.equal(isDurableState(migrated), true);
  const parsed = parseEnvelope(
    JSON.stringify({ schemaVersion: 1, savedAt: NOW.toISOString(), state: legacy }),
  );
  assert.equal(parsed.outcome, 'valid');
  if (parsed.outcome !== 'valid') return;
  assert.equal(parsed.migratedFrom, 1);
  assert.deepEqual(parsed.envelope.state, migrated);
});

test('la sérialisation est stable : l’ordre d’insertion des clés ne change rien', () => {
  // L'ordre des clés d'objet est normalisé ; l'ordre des tableaux reste
  // sémantique et doit être préservé à l'identique.
  const left = serializeStable({ b: 1, a: { d: 2, c: [3, { z: 4, y: 5 }] } });
  const right = serializeStable({ a: { c: [3, { y: 5, z: 4 }], d: 2 }, b: 1 });
  assert.equal(left, right);
  assert.equal(utf8ByteLength('é'), 2);
});

/* ------------------------------------------------------------------ */
/* Sauvegarde après mutation                                           */
/* ------------------------------------------------------------------ */

test('chaque mutation métier est suivie d’une sauvegarde contenant la nouvelle tâche', async () => {
  const storage = new MemoryStorage();
  const durable = makeDurable();
  await saveDurableState(storage, durable, NOW.toISOString());

  const mutated: DurableState = {
    ...durable,
    tasks: [
      {
        id: 'task_new',
        householdId: durable.currentHouseholdId,
        name: 'Arroser les plantes',
        category: 'other',
        weight: 7,
        active: true,
        createdAt: NOW.toISOString(),
      },
      ...durable.tasks,
    ],
  };
  const save = await saveDurableState(storage, mutated, new Date(NOW.getTime() + 1000).toISOString());
  assert.equal(save.ok, true);

  const outcome = await loadDurableState(storage);
  assert.equal(outcome.status, 'restored');
  if (outcome.status !== 'restored') return;
  assert.equal(outcome.state.tasks[0]?.id, 'task_new');
  assert.equal(outcome.state.tasks.length, durable.tasks.length + 1);
});

test('les écritures concurrentes sont sérialisées : la dernière sauvegarde gagne', async () => {
  const storage = new MemoryStorage();
  storage.setDelayMs = 5;
  const writer = createSequentialWriter(storage);
  const first = makeDurable();
  const second: DurableState = {
    ...first,
    currentUserId: 'user_camille',
  };

  const pendingFirst = writer(first, NOW.toISOString());
  const pendingSecond = writer(second, new Date(NOW.getTime() + 10).toISOString());
  const outcomes = await Promise.all([pendingFirst, pendingSecond]);

  assert.deepEqual(outcomes, [
    { ok: true, bytes: utf8ByteLength(serializeEnvelope(first, NOW.toISOString())) },
    { ok: true, bytes: utf8ByteLength(serializeEnvelope(second, new Date(NOW.getTime() + 10).toISOString())) },
  ]);
  assert.equal(storage.hasPendingWrites, false);

  const outcome = await loadDurableState(storage);
  assert.equal(outcome.status, 'restored');
  if (outcome.status !== 'restored') return;
  assert.equal(outcome.state.currentUserId, 'user_camille');

  const writeCalls = storage.calls.filter((call) => call.startsWith(`set:${STORAGE_KEY}`));
  assert.equal(writeCalls.length, 2);
});

/* ------------------------------------------------------------------ */
/* Corruption, versions inconnues, surcharge                           */
/* ------------------------------------------------------------------ */

test('un JSON corrompu est mis en quarantaine puis récupéré sans perte silencieuse', async () => {
  const storage = new MemoryStorage();
  const corrupted = '{"schemaVersion":1,"savedAt":"2026-08-26T12:00:00.000Z","state":{"users":[';
  storage.seed(STORAGE_KEY, corrupted);

  const outcome = await loadDurableState(storage);
  assert.deepEqual(outcome, { status: 'recovered', reason: 'invalid-json', quarantined: true });
  assert.equal(storage.read(STORAGE_KEY), null);
  assert.equal(storage.read(QUARANTINE_KEY), corrupted);
});

test('une version de schéma inconnue est refusée proprement et archivée', async () => {
  const storage = new MemoryStorage();
  const future = JSON.stringify({
    schemaVersion: 99,
    savedAt: NOW.toISOString(),
    state: makeDurable(),
  });
  storage.seed(STORAGE_KEY, future);

  const outcome = await loadDurableState(storage);
  assert.deepEqual(outcome, { status: 'recovered', reason: 'unknown-version', quarantined: true });
  assert.equal(storage.read(QUARANTINE_KEY), future);
  assert.equal(storage.read(STORAGE_KEY), null);
});

test('une version de schéma inférieure au schéma initial est traitée comme invalide', async () => {
  const storage = new MemoryStorage();
  const past = JSON.stringify({
    schemaVersion: 0,
    savedAt: NOW.toISOString(),
    state: makeDurable(),
  });
  storage.seed(STORAGE_KEY, past);

  const outcome = await loadDurableState(storage);
  assert.deepEqual(outcome, { status: 'recovered', reason: 'invalid-shape', quarantined: true });
  assert.equal(storage.read(QUARANTINE_KEY), past);
  assert.equal(storage.read(STORAGE_KEY), null);
});

test('une charge v1 de forme invalide déclenche la récupération explicite', async () => {
  const storage = new MemoryStorage();
  const invalid = JSON.stringify({
    schemaVersion: 1,
    savedAt: NOW.toISOString(),
    state: { users: 'pas-un-tableau' },
  });
  storage.seed(STORAGE_KEY, invalid);

  const outcome = await loadDurableState(storage);
  assert.deepEqual(outcome, { status: 'recovered', reason: 'invalid-shape', quarantined: true });

  for (const raw of ['null', '[1, 2]', '"chaîne"', '{"savedAt":"x"}']) {
    const parsed = parseEnvelope(raw);
    assert.notEqual(parsed.outcome, 'valid');
  }
});

test('une entrée au statut interdit ou une date invalide rend la charge refusée', () => {
  const durable = makeDurable();
  const badStatus = parseEnvelope(
    serializeEnvelope({ ...durable, entries: [runningEntry(NOW.toISOString(), { status: 'archived' as never })] }, NOW.toISOString()),
  );
  assert.equal(badStatus.outcome, 'invalid');
  const badDate = parseEnvelope(
    serializeEnvelope({ ...durable, entries: [runningEntry('pas-une-date')] }, NOW.toISOString()),
  );
  assert.equal(badDate.outcome, 'invalid');
});

test('une charge surdimensionnée est refusée à la lecture et mise en quarantaine', async () => {
  const storage = new MemoryStorage();
  const oversized = `{"schemaVersion":1,"padding":"${'x'.repeat(MAX_SERIALIZED_BYTES + 1)}"}`;
  storage.seed(STORAGE_KEY, oversized);

  const outcome = await loadDurableState(storage);
  assert.deepEqual(outcome, { status: 'recovered', reason: 'oversized', quarantined: true });
  assert.equal(storage.read(QUARANTINE_KEY), oversized);
});

test('une sauvegarde surdimensionnée est refusée avant écriture, le stockage reste intact', async () => {
  const storage = new MemoryStorage();
  const durable = makeDurable();
  await saveDurableState(storage, durable, NOW.toISOString());
  const before = storage.read(STORAGE_KEY);

  const bloated: DurableState = {
    ...durable,
    tasks: [
      ...durable.tasks,
      {
        id: 'task_huge',
        householdId: durable.currentHouseholdId,
        name: 'x'.repeat(MAX_SERIALIZED_BYTES),
        category: 'other',
        weight: 1,
        active: true,
        createdAt: NOW.toISOString(),
      },
    ],
  };
  const save = await saveDurableState(storage, bloated, NOW.toISOString());
  assert.deepEqual(save, { ok: false, error: 'oversized' });
  assert.equal(storage.read(STORAGE_KEY), before);
});

test('un échec d’écriture est signalé sans écraser la valeur précédente', async () => {
  const storage = new MemoryStorage();
  const durable = makeDurable();
  await saveDurableState(storage, durable, NOW.toISOString());
  const before = storage.read(STORAGE_KEY);
  storage.failSet = true;

  const save = await saveDurableState(storage, { ...durable, currentUserId: 'user_sam' }, NOW.toISOString());
  assert.deepEqual(save, { ok: false, error: 'write-failed' });
  assert.equal(storage.read(STORAGE_KEY), before);
});

test('une indisponibilité du stockage renvoie une issue unavailable explicite', async () => {
  const storage = new MemoryStorage();
  storage.failGet = true;
  const outcome = await loadDurableState(storage);
  assert.equal(outcome.status, 'unavailable');
});

/* ------------------------------------------------------------------ */
/* Reprise du chronomètre après redémarrage                            */
/* ------------------------------------------------------------------ */

test('un chrono récent reprend son écoulement depuis l’heure de départ conservée', () => {
  const snapshot = createDemoSnapshot(NOW);
  const startedAt = new Date(NOW.getTime() - 10 * 60 * 1000).toISOString();
  const withTimer = { ...snapshot, entries: [runningEntry(startedAt)] };

  const { snapshot: next, events } = applyRestartRules(withTimer, NOW);
  assert.deepEqual(events, [{ kind: 'resumed', entryId: 'entry_running' }]);
  assert.equal(next.entries[0]?.status, 'in_progress');
  assert.equal(next.entries[0]?.startedAt, startedAt);
  assert.equal(next.entries[0]?.durationSeconds, 0);
});

test('au-delà du seuil de 24 h, le chrono est expiré avec durée plafonnée et score calculé', () => {
  const snapshot = createDemoSnapshot(NOW);
  const startedAt = new Date(NOW.getTime() - 25 * HOUR_SECONDS * 1000).toISOString();
  const expectedCompletedAt = new Date(new Date(startedAt).getTime() + 24 * HOUR_SECONDS * 1000).toISOString();
  const withTimer = { ...snapshot, entries: [runningEntry(startedAt)] };

  const { snapshot: next, events } = applyRestartRules(withTimer, NOW);
  assert.deepEqual(events, [{ kind: 'expired', entryId: 'entry_running' }]);
  const entry = next.entries[0];
  assert.equal(entry?.status, 'completed');
  assert.equal(entry?.durationSeconds, 24 * HOUR_SECONDS);
  assert.equal(entry?.completedAt, expectedCompletedAt);
  assert.equal(entry?.score, (24 * HOUR_SECONDS / 60) * 2);
});

test('borne exacte : 24 h pile expire ; une seconde sous la borne reprend', () => {
  const snapshot = createDemoSnapshot(NOW);
  const atLimit = new Date(NOW.getTime() - 24 * HOUR_SECONDS * 1000).toISOString();
  const underLimit = new Date(NOW.getTime() - (24 * HOUR_SECONDS - 1) * 1000).toISOString();

  const expired = applyRestartRules({ ...snapshot, entries: [runningEntry(atLimit)] }, NOW);
  assert.deepEqual(expired.events, [{ kind: 'expired', entryId: 'entry_running' }]);

  const resumed = applyRestartRules({ ...snapshot, entries: [runningEntry(underLimit)] }, NOW);
  assert.deepEqual(resumed.events, [{ kind: 'resumed', entryId: 'entry_running' }]);
});

test('une entrée active sans heure de départ est clôturée visiblement, jamais perdue', () => {
  const snapshot = createDemoSnapshot(NOW);
  const withBroken = { ...snapshot, entries: [runningEntry(null)] };

  const { snapshot: next, events } = applyRestartRules(withBroken, NOW);
  assert.deepEqual(events, [{ kind: 'repaired', entryId: 'entry_running' }]);
  const entry = next.entries[0];
  assert.equal(entry?.status, 'completed');
  assert.equal(entry?.durationSeconds, 0);
  assert.equal(entry?.score, 0);
  assert.equal(entry?.completedAt, NOW.toISOString());
});

test('les entrées déjà terminées ne sont pas touchées par les règles de reprise', () => {
  const snapshot = createDemoSnapshot(NOW);
  const { snapshot: next, events } = applyRestartRules(snapshot, NOW);
  assert.deepEqual(events, []);
  assert.deepEqual(next, snapshot);
});

test('l’horloge injectée décide seule du sort : même état, deux instants, deux destins', () => {
  const snapshot = createDemoSnapshot(NOW);
  const startedAt = new Date(NOW.getTime() - 23 * HOUR_SECONDS * 1000).toISOString();
  const withTimer = { ...snapshot, entries: [runningEntry(startedAt)] };

  const soon = applyRestartRules(withTimer, new Date(NOW.getTime() + 30 * 1000));
  assert.deepEqual(soon.events, [{ kind: 'resumed', entryId: 'entry_running' }]);

  const later = applyRestartRules(withTimer, new Date(NOW.getTime() + 2 * HOUR_SECONDS * 1000));
  assert.deepEqual(later.events, [{ kind: 'expired', entryId: 'entry_running' }]);
});
