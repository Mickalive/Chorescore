import { isValidWeight } from '../domain/scoring';
import type {
  AppSnapshot,
  ConsentState,
  Household,
  Membership,
  TaskCategory,
  TaskDefinition,
  TaskEntry,
  User,
} from '../domain/types';

/**
 * Couche de persistance de la démo (DRC-02).
 *
 * - frontière de stockage clé/valeur injectée : aucune importation React Native
 *   ici, l'adaptateur AsyncStorage vit dans `src/services/storage.ts` ;
 * - enveloppe versionnée unique (`schemaVersion`) avec sérialisation stable et
 *   déterministe (clés triées) ;
 * - lecture à quatre issues explicites : premier lancement, restauration,
 *   récupération après donnée illisible (quarantaine de la charge brute, jamais
 *   de perte silencieuse), indisponibilité du stockage ;
 * - aucune requête réseau, aucune donnée réelle.
 */

export const STORAGE_KEY = 'chorescore.demo.state.v1';
export const QUARANTINE_KEY = 'chorescore.demo.state.quarantine';
export const SCHEMA_VERSION = 1;
/** Garde-fou anti-dérive : une démo complète tient largement sous cette taille. */
export const MAX_SERIALIZED_BYTES = 512 * 1024;

export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/** Tranche durable de l'état : tout le reste (paywall, avis, compteurs) est éphémère. */
export type DurableState = Pick<
  AppSnapshot,
  'users' | 'household' | 'memberships' | 'tasks' | 'entries' | 'currentUserId'
> & {
  onboardingComplete: boolean;
  consent: ConsentState;
};

export type EnvelopeV1 = {
  schemaVersion: 1;
  savedAt: string;
  state: DurableState;
};

export type RecoveryReason = 'invalid-json' | 'invalid-shape' | 'unknown-version' | 'oversized';

export type ParsedEnvelope =
  | { outcome: 'valid'; envelope: EnvelopeV1 }
  | { outcome: 'invalid'; reason: Extract<RecoveryReason, 'invalid-json' | 'invalid-shape'> }
  | { outcome: 'unknown-version'; schemaVersion: number };

export type LoadOutcome =
  | { status: 'first-launch' }
  | { status: 'restored'; state: DurableState; savedAt: string }
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

export function buildEnvelope(state: DurableState, savedAt: string): EnvelopeV1 {
  return { schemaVersion: SCHEMA_VERSION, savedAt, state };
}

export function serializeEnvelope(state: DurableState, savedAt: string): string {
  return serializeStable(buildEnvelope(state, savedAt));
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
  if (version > SCHEMA_VERSION) {
    return { outcome: 'unknown-version', schemaVersion: version };
  }
  if (version < SCHEMA_VERSION) {
    // Aucune version historique n'existe sous 1 : charge non authentique.
    return { outcome: 'invalid', reason: 'invalid-shape' };
  }
  if (!isDurableState(record.state)) {
    return { outcome: 'invalid', reason: 'invalid-shape' };
  }
  return { outcome: 'valid', envelope: record as unknown as EnvelopeV1 };
}

/* ------------------------------------------------------------------ */
/* Validation structurelle contre le schéma v1                         */
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

export function isDurableState(value: unknown): value is DurableState {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.users) || !value.users.every(isUser)) return false;
  if (!isHousehold(value.household)) return false;
  if (!Array.isArray(value.memberships) || !value.memberships.every(isMembership)) return false;
  if (!Array.isArray(value.tasks) || !value.tasks.every(isTaskDefinition)) return false;
  if (!Array.isArray(value.entries) || !value.entries.every(isTaskEntry)) return false;
  if (!isNonEmptyString(value.currentUserId)) return false;
  if (typeof value.onboardingComplete !== 'boolean') return false;
  if (!isConsent(value.consent)) return false;
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
    case 'valid':
      return { status: 'restored', state: parsed.envelope.state, savedAt: parsed.envelope.savedAt };
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
