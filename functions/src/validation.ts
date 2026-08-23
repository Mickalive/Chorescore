import {
  PAID_TIERS,
  PaidTier,
  TASK_CATEGORIES,
  TaskCategory,
} from "./domain";

export class ValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export type StrictRecord = Readonly<Record<string, unknown>>;

export function strictRecord(
  value: unknown,
  allowedKeys: readonly string[],
): StrictRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ValidationError("Le corps de la requête doit être un objet.");
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      throw new ValidationError(`Champ inconnu : ${key}.`);
    }
  }
  return record;
}

export function requiredString(
  record: StrictRecord,
  key: string,
  minimumLength: number,
  maximumLength: number,
): string {
  const raw = record[key];
  if (typeof raw !== "string") {
    throw new ValidationError(`${key} doit être une chaîne.`);
  }
  const normalized = raw.normalize("NFC").trim();
  if (normalized.length < minimumLength || normalized.length > maximumLength) {
    throw new ValidationError(`${key} a une longueur invalide.`);
  }
  if (/[\u0000-\u001F\u007F]/u.test(normalized)) {
    throw new ValidationError(`${key} contient un caractère interdit.`);
  }
  return normalized;
}

export function firestoreId(record: StrictRecord, key: string): string {
  const value = requiredString(record, key, 1, 128);
  if (!/^[A-Za-z0-9_-]+$/u.test(value) || /^__.*__$/u.test(value)) {
    throw new ValidationError(`${key} n'est pas un identifiant valide.`);
  }
  return value;
}

export function uuidV4(record: StrictRecord, key: string): string {
  const value = requiredString(record, key, 36, 36).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value)) {
    throw new ValidationError(`${key} doit être un UUID v4.`);
  }
  return value;
}

export function timeZone(record: StrictRecord, key: string): string {
  const value = requiredString(record, key, 1, 64);
  try {
    new Intl.DateTimeFormat("fr-CH", { timeZone: value }).format(new Date());
  } catch {
    throw new ValidationError(`${key} doit être un fuseau horaire IANA valide.`);
  }
  return value;
}

export function integer(
  record: StrictRecord,
  key: string,
  minimum: number,
  maximum: number,
  fallback?: number,
): number {
  const raw = record[key];
  if (raw === undefined && fallback !== undefined) {
    return fallback;
  }
  if (!Number.isInteger(raw) || (raw as number) < minimum || (raw as number) > maximum) {
    throw new ValidationError(`${key} doit être un entier entre ${minimum} et ${maximum}.`);
  }
  return raw as number;
}

export function booleanValue(record: StrictRecord, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new ValidationError(`${key} doit être un booléen.`);
  }
  return value;
}

export function paidTier(record: StrictRecord, key: string): PaidTier {
  const value = requiredString(record, key, 1, 16);
  if (!(PAID_TIERS as readonly string[]).includes(value)) {
    throw new ValidationError(`${key} doit être standard ou pro.`);
  }
  return value as PaidTier;
}

export function taskCategory(record: StrictRecord, key: string): TaskCategory {
  const value = requiredString(record, key, 1, 32);
  if (!(TASK_CATEGORIES as readonly string[]).includes(value)) {
    throw new ValidationError(`${key} contient une catégorie inconnue.`);
  }
  return value as TaskCategory;
}

export function inviteToken(record: StrictRecord, key: string): string {
  const value = requiredString(record, key, 43, 43);
  if (!/^[A-Za-z0-9_-]{43}$/u.test(value)) {
    throw new ValidationError(`${key} est invalide.`);
  }
  return value;
}

export function monthlyPeriod(record: StrictRecord, key: string): string {
  const value = requiredString(record, key, 7, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(value)) {
    throw new ValidationError(`${key} doit respecter YYYY-MM.`);
  }
  return value;
}
