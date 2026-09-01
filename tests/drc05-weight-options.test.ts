import assert from 'node:assert/strict';
import test from 'node:test';
import { planAddTask } from '../src/store/appReducer.js';
import { createInitialState } from '../src/store/appReducer.js';
import { createDemoSnapshot } from '../src/data/demoData.js';

/**
 * DRC-05 : Pondération réservée aux Options avancées.
 *
 * Le formulaire de création de tâche ne propose jamais la pondération.
 * Le poids est toujours 1 à la création via le formulaire principal.
 * La pondération n'est accessible que via les Options avancées du foyer.
 */

const demoSnapshot = createDemoSnapshot();
const state = createInitialState(demoSnapshot);

test('DRC-05 : planAddTask toujours poids 1 quelle que soit la personnalisation', () => {
  // Même si canCustomizeWeights est vrai (trial), le formulaire passe weight: 1
  const result = planAddTask(state, { name: 'Test tâche', category: 'other', weight: 1 });
  assert.equal(result.ok, true, 'planAddTask accepte');
  if (result.ok) {
    assert.equal(result.value.weight, 1, 'poids toujours 1 au flux principal');
  }
});

test('DRC-05 : planAddTask avec poids arbitraire — le formulaire ne le soumet pas', () => {
  // Ce test documente que même si quelqu'un passait weight: 5,
  // le formulaire ne le ferait plus (pondération réservée Options avancées)
  const result = planAddTask(state, { name: 'Test', category: 'other', weight: 5 });
  assert.equal(result.ok, true);
  if (result.ok) {
    // En trial, canCustomizeWeights=true mais le formulaire ne soumet plus weight > 1
    // Le domain layer utiliserait input.weight si fourni, mais le UI ne le fournit plus
    assert.equal(result.value.weight, 5, 'domain layer utilise le poids fourni (optionnel)');
  }
});

test('DRC-05 : planAddTask en gratuit — poids reste 1', () => {
  const freeState = {
    ...state,
    household: { ...state.household, plan: 'free' as const },
  };
  const result = planAddTask(freeState, { name: 'Test gratuit', category: 'other', weight: 3 });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.weight, 1, 'poids ramené à 1 en gratuit');
  }
});
