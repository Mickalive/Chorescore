import assert from 'node:assert/strict';
import test from 'node:test';
import { getEffectiveWeight, getEntitlements, getPlanLabel } from '../src/domain/entitlements.js';

test('l’essai ouvre toutes les fonctions sans limite artificielle de membres', () => {
  const trial = getEntitlements('trial');
  assert.equal(trial.useWeights, true);
  assert.equal(trial.canViewAdvancedHistory, true);
  assert.equal(trial.historyDays, null);
  assert.equal(trial.maxMembers, null);
});

test('le gratuit reste utilisable en temps brut avec 30 jours visibles', () => {
  const free = getEntitlements('free');
  assert.equal(free.useWeights, false);
  assert.equal(free.canCustomizeWeights, false);
  assert.equal(free.canViewMonthlyLeaderboard, false);
  assert.equal(free.historyDays, 30);
  assert.equal(free.maxMembers, null);
  assert.equal(getEffectiveWeight('free', 12), 1);
});

test('Standard et Pro ont les mêmes fonctions, mais Standard recommande sept membres au maximum', () => {
  const standard = getEntitlements('standard');
  const pro = getEntitlements('pro');
  assert.deepEqual({ ...standard, maxMembers: null, householdLimit: pro.householdLimit }, pro);
  assert.equal(standard.canViewMonthlyLeaderboard, true);
  assert.equal(standard.maxMembers, 7);
  assert.equal(pro.maxMembers, null);
  assert.equal(getPlanLabel('pro'), 'Pro');
});
