import { isValidWeight } from '../domain/scoring';
import type {
  AppSnapshot,
  CompletedEntry,
  ConsentState,
  Household,
  Membership,
  PersistentTask,
  TaskCategory,
  TaskDefinition,
  TaskEntry,
  TodoItem,
  User,
} from '../domain/types';

/**
 * Couche de persistance de la démo (DRC-02, étendue en DRC-04).
 *
 * - frontière de stockage clé/valeur injectée : aucune importation React Native
 *   ici, l'adaptateur AsyncStorage vit dans `src/services/storage.ts` ;
 * - enveloppe versionnée (`schemaVersion`) avec sérialisation stable et
 *   déterministe (clés triées) ;
 * - schéma v2 : plusieurs foyers locaux isolés dans le même document
 *   (`households` + `currentHouseholdId`) ; la lecture migre explicitement les
 *   documents v1 (foyer unique) vers v2 sans perte, et toute charge illisible
 *   part en quarantaine avant suppression — jamais de perte silencieuse ;
 * - lecture à quatre issues explicites : premier lancement, restauration,
 *   récupération après donnée illisible, indisponibilité du stockage ;
 * - aucune requête réseau, aucune donnée réelle.
 */

export const STORAGE_KEY = 'chorescore.demo.state.v1';
export const QUARANTINE_KEY = 'chorescore.demo.state.quarantine';
export const SCHEMA_VERSION = 2;
/** Garde-fou anti-dérive : une démo complète tient largement sous cette taille. */
export const MAX_SERIALIZED_BYTES = 512 * 1024;

export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/**
 * Tranche durable de l'état : tout le reste (paywall, avis, compteurs) est
 * éphémère. Depuis le schéma v2, le foyer actif n'est pas stocké : il se déduit
 * de `households` et de `currentHouseholdId` à la lecture.
 */
export type DurableState = Pick<
  AppSnapshot,
  'users' | 'memberships' | 'tasks' | 'entries' | 'currentUserId'
> & {
  households: Household[];
  currentHouseholdId: string;
  onboardingComplete: boolean;
  consent: ConsentState;
};

/** Forme historique v1 : un seul foyer, avant les foyers locaux multiples. */
export type LegacyDurableStateV1 = Pick<
  AppSnapshot,
  'users' | 'household' | 'memberships' | 'tasks' | 'entries' | 'currentUserId'
> & {
  onboardingComplete: boolean;
  consent: ConsentState;
};

export type EnvelopeV2 = {
  schemaVersion: 2;
  savedAt: string;
  state: DurableState;
};

export type RecoveryReason = 'invalid-json' | 'invalid-shape' | 'unknown-version' | 'oversized';

export type ParsedEnvelope =
  | { outcome: 'valid'; envelope: EnvelopeV2; migratedFrom?: 1 }
  | { outcome: 'valid-v3'; envelope: EnvelopeV3; migratedFrom?: 2 }
  | { outcome: 'invalid'; reason: Extract<RecoveryReason, 'invalid-json' | 'invalid-shape'> }
  | { outcome: 'unknown-version'; schemaVersion: number };

export type LoadOutcome =
  | { status: 'first-launch' }
  | { status: 'restored'; state: DurableState; savedAt: string; migratedFrom?: 1 }
  | { status: 'restored-v3'; state: DurableStateV3; savedAt: string; migratedFrom?: 2 }
  | { status: 'recovered'; reason: RecoveryReason; quarantined: boolean }
  | { status: 'unavailable'; cause: unknown };

export type SaveOutcome = { ok: true; bytes: number } | { ok: false; error: 'oversized' | 'write-failed' };

/* ------------------------------------------------------------------ */
/* Sérialisation stable et déterministe                                */
/* ------------------------------------------------------------------ */

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      sorted[key] = sortValue(source[key]);
    }
    return sorted;
  }
  return value;
}

/** JSON avec clés triées : deux objets équivalents produisent la même chaîne. */
export function serializeStable(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

/** Longueur UTF-8 sans dépendre de Buffer (indisponible sous Hermes). */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}

/* ------------------------------------------------------------------ */
/* Enveloppe versionnée                                                */
/* ------------------------------------------------------------------ */

export function buildEnvelope(state: DurableState, savedAt: string): EnvelopeV2 {
  return { schemaVersion: SCHEMA_VERSION, savedAt, state };
}

export function serializeEnvelope(state: DurableState, savedAt: string): string {
  return serializeStable(buildEnvelope(state, savedAt));
}

/* ------------------------------------------------------------------ */
/* Schéma V3 : modèle canonique CompletedEntry (DRC-01)                */
/* ------------------------------------------------------------------ */

export const SCHEMA_VERSION_V3 = 3;

/**
 * Tranche durable V3 : le modèle canonique remplace TaskDefinition par
 * PersistentTask et TaskEntry par CompletedEntry. Les trois objets métier
 * (CompletedEntry, PersistentTask, TodoItem) sont distincts.
 */
export type DurableStateV3 = {
  users: User[];
  households: Household[];
  memberships: Membership[];
  persistentTasks: PersistentTask[];
  completedEntries: CompletedEntry[];
  todoItems: TodoItem[];
  currentUserId: string;
  currentHouseholdId: string;
  onboardingComplete: boolean;
  consent: ConsentState;
};

export type EnvelopeV3 = {
  schemaVersion: 3;
  savedAt: string;
  state: DurableStateV3;
};

/**
 * Migration V2 -> V3 : TaskDefinition devient PersistentTask, TaskEntry
 * completed devient CompletedEntry avec performedByMemberId et
 * beneficiaryMemberIds. Les entrées in_progress sont abandonnées (chrono
 * non terminé = aucune réalisation).
 */
export function migrateV2ToV3(v2: DurableState): DurableStateV3 {
  const persistentTasks: PersistentTask[] = v2.tasks.map((task) => ({
    id: task.id,
    householdId: task.householdId,
    name: task.name,
    defaultWeight: task.weight,
    createdAt: task.createdAt,
  }));

  const completedEntries: CompletedEntry[] = v2.entries
    .filter((entry): entry is TaskEntry & { status: 'completed'; completedAt: string } =>
      entry.status === 'completed' && entry.completedAt !== null,
    )
    .map((entry) => {
      const taskName =
        v2.tasks.find((t) => t.id === entry.taskId)?.name ?? 'Tâche migrée';
      return {
        id: entry.id,
        label: taskName,
        householdId: entry.householdId,
        performedByMemberId: entry.userId,
        beneficiaryMemberIds: [entry.userId],
        durationSeconds: entry.durationSeconds,
        completedAt: entry.completedAt,
        persistentTaskId: entry.taskId,
        weight: 1,
      };
    });

  return {
    users: v2.users,
    households: v2.households,
    memberships: v2.memberships,
    persistentTasks,
    completedEntries,
    todoItems: [],
    currentUserId: v2.currentUserId,
    currentHouseholdId: v2.currentHouseholdId,
    onboardingComplete: v2.onboardingComplete,
    consent: v2.consent,
  };
}

export function buildEnvelopeV3(state: DurableStateV3, savedAt: string): EnvelopeV3 {
  return { schemaVersion: SCHEMA_VERSION_V3, savedAt, state };
}

export function serializeEnvelopeV3(state: DurableStateV3, savedAt: string): string {
  return serializeStable(buildEnvelopeV3(state, savedAt));
}

/* ------------------------------------------------------------------ */
/* Validation structurelle V3                                          */
/* ------------------------------------------------------------------ */

function isCompletedEntry(value: unknown): value is CompletedEntry {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.label) &&
    isNonEmptyString(value.householdId) &&
    isNonEmptyString(value.performedByMemberId) &&
    Array.isArray(value.beneficiaryMemberIds) &&
    value.beneficiaryMemberIds.length > 0 &&
    value.beneficiaryMemberIds.every((id: unknown) => isNonEmptyString(id)) &&
    typeof value.durationSeconds === 'number' &&
    Number.isFinite(value.durationSeconds) &&
    value.durationSeconds > 0 &&
    isIsoDate(value.completedAt) &&
    (value.persistentTaskId === null || isNonEmptyString(value.persistentTaskId)) &&
    typeof value.weight === 'number' &&
    Number.isFinite(value.weight) &&
    value.weight >= 0
  );
}

function isPersistentTask(value: unknown): value is PersistentTask {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.householdId) &&
    isNonEmptyString(value.name) &&
    typeof value.defaultWeight === 'number' &&
    isIsoDate(value.createdAt)
  );
}

function isTodoItem(value: unknown): value is TodoItem {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.householdId) &&
    isNonEmptyString(value.label) &&
    (value.assigneeMemberId === null || isNonEmptyString(value.assigneeMemberId)) &&
    Array.isArray(value.beneficiaryMemberIds) &&
    value.beneficiaryMemberIds.every((id: unknown) => isNonEmptyString(id)) &&
    (value.dueDate === null || isIsoDate(value.dueDate)) &&
    typeof value.note === 'string' &&
    (value.persistentTaskId === null || isNonEmptyString(value.persistentTaskId)) &&
    isIsoDate(value.createdAt) &&
    (value.completedAt === null || isIsoDate(value.completedAt))
  );
}

/**
 * Validateur V3 : modèle canonique avec CompletedEntry, PersistentTask et
 * TodoItem. L'intégrité référentielle vérifie les foyers, membres et
 * cohérence des beneficiarieMemberIds.
 */
export function isDurableStateV3(value: unknown): value is DurableStateV3 {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.users) || !value.users.every(isUser)) return false;
  if (
    !Array.isArray(value.households) ||
    value.households.length === 0 ||
    !value.households.every(isHousehold)
  ) {
    return false;
  }
  if (!Array.isArray(value.memberships) || !value.memberships.every(isMembership)) return false;
  if (!Array.isArray(value.persistentTasks) || !value.persistentTasks.every(isPersistentTask)) {
    return false;
  }
  if (
    !Array.isArray(value.completedEntries) ||
    !value.completedEntries.every(isCompletedEntry)
  ) {
    return false;
  }
  if (!Array.isArray(value.todoItems) || !value.todoItems.every(isTodoItem)) {
    return false;
  }
  if (!isNonEmptyString(value.currentHouseholdId)) return false;
  if (!isNonEmptyString(value.currentUserId)) return false;
  if (typeof value.onboardingComplete !== 'boolean') return false;
  if (!isConsent(value.consent)) return false;

  const householdIds = new Set<string>();
  for (const household of value.households) {
    if (householdIds.has(household.id)) return false;
    householdIds.add(household.id);
  }
  if (!householdIds.has(value.currentHouseholdId)) return false;

  const userIds = new Set<string>();
  for (const user of value.users) {
    if (userIds.has(user.id)) return false;
    userIds.add(user.id);
  }
  if (!userIds.has(value.currentUserId)) return false;

  const membershipPairs = new Set<string>();
  for (const membership of value.memberships) {
    if (!householdIds.has(membership.householdId) || !userIds.has(membership.userId)) {
      return false;
    }
    const key = `${membership.householdId}\u0000${membership.userId}`;
    if (membershipPairs.has(key)) return false;
    membershipPairs.add(key);
  }
  if (!membershipPairs.has(`${value.currentHouseholdId}\u0000${value.currentUserId}`)) {
    return false;
  }

  // PersistentTasks must belong to a known household
  for (const pt of value.persistentTasks) {
    if (!householdIds.has(pt.householdId)) return false;
  }

  // CompletedEntries must belong to a known household with valid members
  for (const entry of value.completedEntries) {
    if (!householdIds.has(entry.householdId)) return false;
    if (!membershipPairs.has(`${entry.householdId}\u0000${entry.performedByMemberId}`)) return false;
    for (const beneficiaryId of entry.beneficiaryMemberIds) {
      if (!membershipPairs.has(`${entry.householdId}\u0000${beneficiaryId}`)) return false;
    }
    // If linked to a persistent task, it must exist in the same household
    if (entry.persistentTaskId !== null) {
      const pt = value.persistentTasks.find((t) => t.id === entry.persistentTaskId);
      if (pt === undefined || pt.householdId !== entry.householdId) return false;
    }
  }

  // TodoItems must belong to a known household with valid members
  for (const todo of value.todoItems) {
    if (!householdIds.has(todo.householdId)) return false;
    if (todo.assigneeMemberId !== null) {
      if (!membershipPairs.has(`${todo.householdId}\u0000${todo.assigneeMemberId}`)) return false;
    }
  }

  return true;
}

/**
 * Migration explicite v1 -> v2 : le foyer unique devient une collection d'un
 * élément et le foyer actif est identifié par son identifiant. Aucune donnée
 * métier n'est modifiée.
 */
export function migrateV1ToV2(legacy: LegacyDurableStateV1): DurableState {
  const { household, ...rest } = legacy;
  return {
    ...rest,
    households: [household],
    currentHouseholdId: household.id,
  };
}

export function parseEnvelope(raw: string): ParsedEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { outcome: 'invalid', reason: 'invalid-json' };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { outcome: 'invalid', reason: 'invalid-shape' };
  }
  const record = parsed as Record<string, unknown>;
  const version = record.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return { outcome: 'invalid', reason: 'invalid-shape' };
  }
  if (version > SCHEMA_VERSION_V3) {
    return { outcome: 'unknown-version', schemaVersion: version };
  }
  if (version === 1) {
    // Seule version historique : migration sûre vers v2 après contrôle de la
    // forme d'origine. Une forme v1 invalide suit le parcours de quarantaine.
    if (!isLegacyDurableStateV1(record.state)) {
      return { outcome: 'invalid', reason: 'invalid-shape' };
    }
    const migrated = migrateV1ToV2(record.state);
    // Le validateur v2 est strictement plus exigeant que le v1 (adhésions
    // rattachées à un foyer et un utilisateur connus, personne active membre
    // du foyer actif, entrées cohérentes avec le foyer de leur tâche). Rejouer
    // la validation complète sur l'état migré garantit qu'un document v1
    // référentiellement incohérent ne soit jamais chargé puis re-persisté en
    // enveloppe v2 — ce qui le condamnerait à la quarantaine à la relance
    // suivante. Il est refusé ici, dès la première lecture.
    if (!isDurableState(migrated)) {
      return { outcome: 'invalid', reason: 'invalid-shape' };
    }
    const envelope = buildEnvelope(migrated, record.savedAt as string);
    return { outcome: 'valid', envelope, migratedFrom: 1 };
  }
  if (version < 1) {
    // Aucune version historique n'existe sous 1 : charge non authentique.
    return { outcome: 'invalid', reason: 'invalid-shape' };
  }
  if (version === 2) {
    if (!isDurableState(record.state)) {
      return { outcome: 'invalid', reason: 'invalid-shape' };
    }
    const envelope = buildEnvelope(record.state, record.savedAt as string);
    return { outcome: 'valid', envelope };
  }
  if (version === 3) {
    if (!isDurableStateV3(record.state)) {
      return { outcome: 'invalid', reason: 'invalid-shape' };
    }
    return { outcome: 'valid-v3', envelope: record as unknown as EnvelopeV3 };
  }
  return { outcome: 'invalid', reason: 'invalid-shape' };
}

/* ------------------------------------------------------------------ */
/* Validation structurelle contre le schéma courant                    */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
}

function isPlanScenario(value: unknown): value is Household['plan'] {
  return value === 'trial' || value === 'free' || value === 'standard' || value === 'pro';
}

function isTaskCategory(value: unknown): value is TaskCategory {
  return (
    value === 'dishes' ||
    value === 'cooking' ||
    value === 'cleaning' ||
    value === 'laundry' ||
    value === 'shopping' ||
    value === 'other'
  );
}

function isEntryStatus(value: unknown): value is TaskEntry['status'] {
  return value === 'in_progress' || value === 'completed';
}

function isWeight(value: unknown): value is number {
  return typeof value === 'number' && isValidWeight(value);
}

function isUser(value: unknown): value is User {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.initials) &&
    isNonEmptyString(value.color)
  );
}

function isHousehold(value: unknown): value is Household {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.timezone) &&
    isPlanScenario(value.plan) &&
    isIsoDate(value.trialStartedAt) &&
    isIsoDate(value.trialEndsAt) &&
    (value.maxMembers === null || (typeof value.maxMembers === 'number' && Number.isInteger(value.maxMembers)))
  );
}

function isMembership(value: unknown): value is Membership {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.householdId) &&
    isNonEmptyString(value.userId) &&
    (value.role === 'owner' || value.role === 'member') &&
    isIsoDate(value.joinedAt)
  );
}

function isTaskDefinition(value: unknown): value is TaskDefinition {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.householdId) &&
    isNonEmptyString(value.name) &&
    isTaskCategory(value.category) &&
    isWeight(value.weight) &&
    typeof value.active === 'boolean' &&
    isIsoDate(value.createdAt)
  );
}

function isTaskEntry(value: unknown): value is TaskEntry {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.taskId) &&
    isNonEmptyString(value.householdId) &&
    isNonEmptyString(value.userId) &&
    isEntryStatus(value.status) &&
    (value.startedAt === null || isIsoDate(value.startedAt)) &&
    (value.completedAt === null || isIsoDate(value.completedAt)) &&
    typeof value.durationSeconds === 'number' &&
    Number.isFinite(value.durationSeconds) &&
    value.durationSeconds >= 0 &&
    isWeight(value.weightSnapshot) &&
    typeof value.score === 'number' &&
    Number.isFinite(value.score) &&
    value.score >= 0 &&
    typeof value.isManual === 'boolean' &&
    isNonEmptyString(value.periodKey)
  );
}

function isConsent(value: unknown): value is ConsentState {
  if (!isRecord(value)) return false;
  return (
    typeof value.termsAccepted === 'boolean' &&
    isNonEmptyString(value.termsVersion) &&
    (value.acceptedAt === null || isIsoDate(value.acceptedAt)) &&
    typeof value.analyticsOptIn === 'boolean'
  );
}

/**
 * Forme historique v1, contrôlée avec les règles d'origine (foyer unique) afin
 * que tout document autrefois valide reste lisible par la migration.
 */
export function isLegacyDurableStateV1(value: unknown): value is LegacyDurableStateV1 {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.users) || !value.users.every(isUser)) return false;
  if (!isHousehold(value.household)) return false;
  if (!Array.isArray(value.memberships) || !value.memberships.every(isMembership)) return false;
  if (!Array.isArray(value.tasks) || !value.tasks.every(isTaskDefinition)) return false;
  if (!Array.isArray(value.entries) || !value.entries.every(isTaskEntry)) return false;
  if (!isNonEmptyString(value.currentUserId)) return false;
  if (typeof value.onboardingComplete !== 'boolean') return false;
  if (!isConsent(value.consent)) return false;
  // Invariants référentiels d'origine (constats MOB-CYCLE32857952394-F1/F2) :
  // identifiants uniques par collection et entrées rattachées à des tâches et
  // des utilisateurs existants du même document. Les adhésions n'ont pas
  // d'identifiant propre : leur clé naturelle est la paire (foyer, utilisateur).
  const userIds = new Set<string>();
  for (const user of value.users) {
    if (userIds.has(user.id)) {
      return false;
    }
    userIds.add(user.id);
  }
  const membershipKeys = new Set<string>();
  for (const membership of value.memberships) {
    const key = `${membership.householdId}\u0000${membership.userId}`;
    if (membershipKeys.has(key)) {
      return false;
    }
    membershipKeys.add(key);
  }
  const taskIds = new Set<string>();
  for (const task of value.tasks) {
    if (taskIds.has(task.id)) {
      return false;
    }
    taskIds.add(task.id);
  }
  const entryIds = new Set<string>();
  for (const entry of value.entries) {
    if (entryIds.has(entry.id)) {
      return false;
    }
    entryIds.add(entry.id);
    if (!taskIds.has(entry.taskId) || !userIds.has(entry.userId)) {
      return false;
    }
  }
  return true;
}

/**
 * Validateur du schéma v2 (foyers locaux multiples, DRC-04). Outre les formes
 * par collection, il impose l'intégrité référentielle entre foyers :
 * - identifiants de foyers uniques et foyer actif existant ;
 * - adhésions, tâches et entrées rattachées à un foyer connu ;
 * - chaque entrée pointe une tâche du même foyer et un membre (adhésion
 *   réelle) de son propre foyer ;
 * - l'utilisateur actif existe et appartient au foyer actif.
 * Une charge qui viole ces invariants est refusée comme forme invalide : elle
 * part en quarantaine avec le parcours visible habituel, jamais de perte
 * silencieuse.
 */
export function isDurableState(value: unknown): value is DurableState {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.users) || !value.users.every(isUser)) return false;
  if (!Array.isArray(value.households) || value.households.length === 0 || !value.households.every(isHousehold)) {
    return false;
  }
  if (!Array.isArray(value.memberships) || !value.memberships.every(isMembership)) return false;
  if (!Array.isArray(value.tasks) || !value.tasks.every(isTaskDefinition)) return false;
  if (!Array.isArray(value.entries) || !value.entries.every(isTaskEntry)) return false;
  if (!isNonEmptyString(value.currentHouseholdId)) return false;
  if (!isNonEmptyString(value.currentUserId)) return false;
  if (typeof value.onboardingComplete !== 'boolean') return false;
  if (!isConsent(value.consent)) return false;

  const householdIds = new Set<string>();
  for (const household of value.households) {
    if (householdIds.has(household.id)) {
      return false;
    }
    householdIds.add(household.id);
  }
  if (!householdIds.has(value.currentHouseholdId)) {
    return false;
  }

  const userIds = new Set<string>();
  for (const user of value.users) {
    if (userIds.has(user.id)) {
      return false;
    }
    userIds.add(user.id);
  }
  if (!userIds.has(value.currentUserId)) {
    return false;
  }

  const membershipKeys = new Set<string>();
  const membershipByPair = new Set<string>();
  for (const membership of value.memberships) {
    if (!householdIds.has(membership.householdId) || !userIds.has(membership.userId)) {
      return false;
    }
    const key = `${membership.householdId}\u0000${membership.userId}`;
    if (membershipKeys.has(key)) {
      return false;
    }
    membershipKeys.add(key);
    membershipByPair.add(key);
  }
  if (!membershipByPair.has(`${value.currentHouseholdId}\u0000${value.currentUserId}`)) {
    return false;
  }

  const taskById = new Map<string, TaskDefinition>();
  for (const task of value.tasks) {
    if (taskById.has(task.id) || !householdIds.has(task.householdId)) {
      return false;
    }
    taskById.set(task.id, task);
  }

  const entryIds = new Set<string>();
  for (const entry of value.entries) {
    if (entryIds.has(entry.id)) {
      return false;
    }
    entryIds.add(entry.id);
    const task = taskById.get(entry.taskId);
    if (
      task === undefined ||
      task.householdId !== entry.householdId ||
      !userIds.has(entry.userId) ||
      !membershipByPair.has(`${entry.householdId}\u0000${entry.userId}`)
    ) {
      return false;
    }
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Lecture et écriture                                                 */
/* ------------------------------------------------------------------ */

async function quarantine(
  storage: KeyValueStorage,
  raw: string,
  reason: RecoveryReason,
): Promise<LoadOutcome> {
  let quarantined = false;
  try {
    await storage.setItem(QUARANTINE_KEY, raw);
    await storage.removeItem(STORAGE_KEY);
    quarantined = true;
  } catch {
    quarantined = false;
  }
  return { status: 'recovered', reason, quarantined };
}

export async function loadDurableState(storage: KeyValueStorage): Promise<LoadOutcome> {
  let raw: string | null;
  try {
    raw = await storage.getItem(STORAGE_KEY);
  } catch (cause) {
    return { status: 'unavailable', cause };
  }
  if (raw === null) {
    return { status: 'first-launch' };
  }
  if (utf8ByteLength(raw) > MAX_SERIALIZED_BYTES) {
    return quarantine(storage, raw, 'oversized');
  }
  const parsed = parseEnvelope(raw);
  switch (parsed.outcome) {
    case 'valid': {
      // Auto-migrate V2 → V3 : the canonical model replaces the legacy model.
      // V1 migrations already returned 'valid' with migratedFrom=1 and stay as
      // DurableState; only pure V2 (schemaVersion 2, no prior migration) gets
      // promoted to V3.
      if (parsed.envelope.schemaVersion === 2 && !parsed.migratedFrom) {
        const v3 = migrateV2ToV3(parsed.envelope.state);
        const restored: LoadOutcome = {
          status: 'restored-v3',
          state: v3,
          savedAt: parsed.envelope.savedAt,
          migratedFrom: 2,
        };
        return restored;
      }
      const restored: LoadOutcome = {
        status: 'restored',
        state: parsed.envelope.state,
        savedAt: parsed.envelope.savedAt,
      };
      if (parsed.migratedFrom === 1) {
        restored.migratedFrom = 1;
      }
      return restored;
    }
    case 'valid-v3': {
      const restored: LoadOutcome = {
        status: 'restored-v3',
        state: parsed.envelope.state,
        savedAt: parsed.envelope.savedAt,
      };
      if (parsed.migratedFrom === 2) {
        restored.migratedFrom = 2;
      }
      return restored;
    }
    case 'unknown-version':
      return quarantine(storage, raw, 'unknown-version');
    case 'invalid':
      return quarantine(storage, raw, parsed.reason);
  }
}

export async function saveDurableState(
  storage: KeyValueStorage,
  state: DurableState,
  savedAt: string,
): Promise<SaveOutcome> {
  const serialized = serializeEnvelope(state, savedAt);
  const bytes = utf8ByteLength(serialized);
  if (bytes > MAX_SERIALIZED_BYTES) {
    return { ok: false, error: 'oversized' };
  }
  try {
    await storage.setItem(STORAGE_KEY, serialized);
    return { ok: true, bytes };
  } catch {
    return { ok: false, error: 'write-failed' };
  }
}

/** Sauvegarde V3 du modèle canonique CompletedEntry. */
export async function saveDurableStateV3(
  storage: KeyValueStorage,
  state: DurableStateV3,
  savedAt: string,
): Promise<SaveOutcome> {
  const serialized = serializeEnvelopeV3(state, savedAt);
  const bytes = utf8ByteLength(serialized);
  if (bytes > MAX_SERIALIZED_BYTES) {
    return { ok: false, error: 'oversized' };
  }
  try {
    await storage.setItem(STORAGE_KEY, serialized);
    return { ok: true, bytes };
  } catch {
    return { ok: false, error: 'write-failed' };
  }
}

/**
 * Sérialise les écritures : les sauvegardes qui se chevauchent s'exécutent dans
 * l'ordre d'appel et la dernière gagne, sans entrelacement.
 */
export function createSequentialWriter(storage: KeyValueStorage) {
  let tail: Promise<unknown> = Promise.resolve();
  return (state: DurableState, savedAt: string): Promise<SaveOutcome> => {
    const run = tail.then(() => saveDurableState(storage, state, savedAt));
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}

/** Writer V3 pour le modèle canonique. */
export function createSequentialWriterV3(storage: KeyValueStorage) {
  let tail: Promise<unknown> = Promise.resolve();
  return (state: DurableStateV3, savedAt: string): Promise<SaveOutcome> => {
    const run = tail.then(() => saveDurableStateV3(storage, state, savedAt));
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
