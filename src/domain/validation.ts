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
  return value.replace(/[\u0000-\u001F\u007F]/g, '').trim().replace(/\s+/g, ' ');
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
