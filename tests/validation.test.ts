import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTaskName, validateManualMinutes, validateTaskInput } from '../src/domain/validation.js';

test('le nom est normalisé et les caractères de contrôle sont retirés', () => {
  assert.equal(normalizeTaskName('  Ranger\n   le salon  '), 'Ranger le salon');
});

test('la validation rejette les entrées hors limites', () => {
  assert.equal(validateTaskInput({ name: 'A', category: 'other', weight: 1 }) !== null, true);
  assert.equal(validateTaskInput({ name: 'Ranger', category: 'other', weight: 1001 }) !== null, true);
  assert.equal(validateTaskInput({ name: 'Ranger', category: 'other', weight: 2 }), null);
  assert.equal(validateManualMinutes(0) !== null, true);
  assert.equal(validateManualMinutes(25), null);
  assert.equal(validateManualMinutes(1441) !== null, true);
});
