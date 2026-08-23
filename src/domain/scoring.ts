import type { TaskEntry } from './types';

export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 1000;
export const MAX_DURATION_SECONDS = 24 * 60 * 60;

export function isValidWeight(weight: number): boolean {
  return Number.isInteger(weight) && weight >= MIN_WEIGHT && weight <= MAX_WEIGHT;
}

export function isValidDuration(durationSeconds: number): boolean {
  return (
    Number.isFinite(durationSeconds) &&
    durationSeconds > 0 &&
    durationSeconds <= MAX_DURATION_SECONDS
  );
}

export function calculateScore(durationSeconds: number, weight: number): number {
  if (!isValidDuration(durationSeconds)) {
    throw new RangeError('La durée doit être comprise entre 1 seconde et 24 heures.');
  }

  if (!isValidWeight(weight)) {
    throw new RangeError('Le poids doit être un entier compris entre 1 et 1000.');
  }

  return (durationSeconds / 60) * weight;
}

export function getEntryValue(entry: TaskEntry, useWeights: boolean): number {
  return useWeights ? entry.score : entry.durationSeconds / 60;
}

export function formatMetric(value: number, useWeights: boolean): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toLocaleString('fr-CH')} ${useWeights ? 'pts' : 'min'}`;
}
