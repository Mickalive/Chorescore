import type { TaskCategory } from './types';
import { isValidWeight } from './scoring';

const ALLOWED_CATEGORIES = new Set<TaskCategory>([
  'dishes',
  'cooking',
  'cleaning',
  'laundry',
  'shopping',
  'other',
]);

export type TaskInput = {
  name: string;
  category: TaskCategory;
  weight: number;
};

export function normalizeTaskName(value: string): string {
  // Les caractères de contrôle (C0, DEL, C1) deviennent des séparateurs afin
  // qu'un nom collé avec un saut de ligne ne soude pas deux mots.
  return value.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').trim().replace(/\s+/g, ' ');
}

export function validateTaskInput(input: TaskInput): string | null {
  const normalizedName = normalizeTaskName(input.name);
  if (normalizedName.length < 2) {
    return 'Le nom doit contenir au moins 2 caractères.';
  }
  if (normalizedName.length > 60) {
    return 'Le nom ne peut pas dépasser 60 caractères.';
  }
  if (!ALLOWED_CATEGORIES.has(input.category)) {
    return 'La catégorie sélectionnée est invalide.';
  }
  if (!isValidWeight(input.weight)) {
    return 'Le poids doit être un entier compris entre 1 et 1000.';
  }
  return null;
}

export function validateManualMinutes(value: number): string | null {
  if (!Number.isInteger(value) || value < 1 || value > 24 * 60) {
    return 'La durée doit être un nombre entier entre 1 et 1440 minutes.';
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* CompletedEntry validation (DRC-01)                                  */
/* ------------------------------------------------------------------ */

export function validateCompletedEntryLabel(label: string): string | null {
  const normalized = normalizeTaskName(label);
  if (normalized.length < 1) {
    return 'Le libellé ne peut pas être vide.';
  }
  if (normalized.length > 100) {
    return 'Le libellé ne peut pas dépasser 100 caractères.';
  }
  return null;
}

export function validateBeneficiaryIds(ids: string[]): string | null {
  if (ids.length === 0) {
    return 'Au moins un bénéficiaire doit être sélectionné.';
  }
  return null;
}

export function validatePerformedBy(memberId: string): string | null {
  if (typeof memberId !== 'string' || memberId.length === 0) {
    return 'Un membre doit être sélectionné pour « Fait par ».';
  }
  return null;
}
