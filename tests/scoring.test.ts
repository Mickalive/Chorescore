import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateScore, getEntryValue, isValidDuration, isValidWeight } from '../src/domain/scoring.js';
import type { TaskEntry } from '../src/domain/types.js';

const ENTRY: TaskEntry = {
  id: 'entry_1',
  taskId: 'task_1',
  householdId: 'household_1',
  userId: 'user_1',
  status: 'completed',
  startedAt: null,
  completedAt: '2026-08-24T10:00:00.000Z',
  durationSeconds: 45 * 60,
  weightSnapshot: 2,
  score: 90,
  isManual: true,
  periodKey: '2026-W35',
};

test('le score est la durée en minutes multipliée par le poids', () => {
  assert.equal(calculateScore(45 * 60, 2), 90);
  assert.equal(calculateScore(30, 3), 1.5);
});

test('la valeur gratuite ignore les poids historiques', () => {
  assert.equal(getEntryValue(ENTRY, true), 90);
  assert.equal(getEntryValue(ENTRY, false), 45);
});

test('les limites de poids et durée sont strictes', () => {
  assert.equal(isValidWeight(1), true);
  assert.equal(isValidWeight(1000), true);
  assert.equal(isValidWeight(0), false);
  assert.equal(isValidWeight(1.5), false);
  assert.equal(isValidDuration(1), true);
  assert.equal(isValidDuration(24 * 60 * 60), true);
  assert.equal(isValidDuration(0), false);
  assert.throws(() => calculateScore(60, 1001), RangeError);
});
