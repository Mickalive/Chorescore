import assert from 'node:assert/strict';
import test from 'node:test';
import { computeErrorAnnouncement } from '../src/domain/formFeedback.js';
import type { ErrorAnnouncement } from '../src/domain/formFeedback.js';
import type { TaskCategory } from '../src/domain/types.js';
import { validateManualMinutes, validateTaskInput } from '../src/domain/validation.js';

// Les tests couvrent les conditions de données des annonces d'erreur des
// modales (sélecteurs purs) : ils ne simulent aucun lecteur d'écran. Le câblage
// réel des composants est `computeErrorAnnouncement(précédent, validateur(...))`
// ; chaque test reproduit exactement ce câblage avec les vrais validateurs.

// ——— Modale « Nouvelle tâche » : nom vide ———

test('première erreur de nom vide : annonce créée avec le message exact du validateur', () => {
  const error = validateTaskInput({ name: '  ', category: 'other', weight: 1 });
  assert.equal(error, 'Le nom doit contenir au moins 2 caractères.');
  const announcement = computeErrorAnnouncement(null, error);
  assert.deepEqual(announcement, { message: error, token: 1 });
});

test('erreur identique répétée : le jeton progresse pour forcer une nouvelle annonce', () => {
  const error = validateTaskInput({ name: '', category: 'other', weight: 1 });
  const first = computeErrorAnnouncement(null, error);
  assert.ok(first !== null);
  // Deuxième soumission sans corriger : même message, nouveau jeton.
  const second = computeErrorAnnouncement(first, error);
  assert.deepEqual(second, { message: error, token: 2 });
});

test('erreur corrigée puis nouvelle erreur : le jeton continue de progresser', () => {
  const emptyName = validateTaskInput({ name: '', category: 'other', weight: 1 });
  const first = computeErrorAnnouncement(null, emptyName);
  assert.ok(first !== null);
  // L'utilisateur corrige : plus d'annonce.
  assert.equal(computeErrorAnnouncement(first, null), null);
  // Nouvelle erreur différente (poids invalide) : message mis à jour, jeton +1.
  const badWeight = validateTaskInput({ name: 'Ranger le salon', category: 'other', weight: 0 });
  assert.equal(badWeight, 'Le poids doit être un entier compris entre 1 et 1000.');
  const second = computeErrorAnnouncement(first, badWeight);
  assert.deepEqual(second, { message: badWeight, token: 2 });
});

// ——— Modale « Ajouter un temps » : durée invalide ———

test('durée non numérique : annonce créée avec le message exact du validateur', () => {
  const error = validateManualMinutes(Number('pas un nombre'));
  assert.equal(error, 'La durée doit être un nombre entier entre 1 et 1440 minutes.');
  const announcement = computeErrorAnnouncement(null, error);
  assert.deepEqual(announcement, { message: error, token: 1 });
});

test('durée invalide répétée à l’identique : re-annonce garantie par le jeton', () => {
  const error = validateManualMinutes(12.5);
  const first = computeErrorAnnouncement(null, error);
  assert.ok(first !== null);
  const second = computeErrorAnnouncement(first, error);
  assert.equal(second?.message, first.message);
  assert.equal(second?.token, first.token + 1);
});

// ——— Conditions de non-annonce ———

test('aucune annonce inventée : message absent ou vide réinitialise l’état', () => {
  assert.equal(computeErrorAnnouncement(null, null), null);
  const previous: ErrorAnnouncement = { message: 'x', token: 3 };
  assert.equal(computeErrorAnnouncement(previous, null), null);
  assert.equal(computeErrorAnnouncement(previous, ''), null);
});

test('validation réussie : aucune annonce, condition identique à la remise à zéro', () => {
  const validName = validateTaskInput({ name: 'Ranger le salon', category: 'other', weight: 1 });
  const validMinutes = validateManualMinutes(25);
  assert.equal(validName, null);
  assert.equal(validMinutes, null);
  assert.equal(computeErrorAnnouncement(null, validName), null);
  assert.equal(computeErrorAnnouncement(null, validMinutes), null);
});

// ——— Parcours complet d’une modale, conditions de données pures ———

test('parcours modale tâche : deux erreurs successives puis succès sans annonce', () => {
  let announcement: ErrorAnnouncement | null = null;
  const inputs: Array<{ name: string; category: TaskCategory; weight: number }> = [
    { name: '', category: 'other', weight: 1 },
    { name: 'A', category: 'other', weight: 1 },
    { name: 'Arroser les plantes', category: 'other', weight: 1 },
  ];
  const tokens: number[] = [];
  for (const input of inputs) {
    const next = computeErrorAnnouncement(announcement, validateTaskInput(input));
    if (next !== null) {
      tokens.push(next.token);
    }
    announcement = next;
  }
  // Deux annonces (tokens 1 et 2), puis validation réussie sans annonce.
  assert.deepEqual(tokens, [1, 2]);
  assert.equal(announcement, null);
});
