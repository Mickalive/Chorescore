import assert from 'node:assert/strict';
import test from 'node:test';
import { getDaysRemaining, getIsoWeekKey, isWithinLastDays, startOfWeek } from '../src/domain/periods.js';

test('la semaine démarre le lundi', () => {
  const sunday = new Date(2026, 7, 23, 12, 0, 0);
  const monday = startOfWeek(sunday);
  assert.equal(monday.getDay(), 1);
  assert.equal(monday.getDate(), 17);
});

test('la clé ISO contient l’année et la semaine', () => {
  assert.equal(getIsoWeekKey(new Date(2026, 0, 1, 12, 0, 0)), '2026-W01');
});

test('les fenêtres historiques et le compteur de jours excluent les valeurs négatives', () => {
  const now = new Date(2026, 7, 24, 12, 0, 0);
  assert.equal(isWithinLastDays(new Date(2026, 6, 26, 12, 0, 0).toISOString(), 30, now), true);
  assert.equal(isWithinLastDays(new Date(2026, 6, 25, 12, 0, 0).toISOString(), 30, now), false);
  assert.equal(getDaysRemaining(new Date(2026, 7, 26, 12, 0, 0).toISOString(), now), 2);
  assert.equal(getDaysRemaining(new Date(2026, 7, 20, 12, 0, 0).toISOString(), now), 0);
});
