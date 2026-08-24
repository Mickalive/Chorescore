import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDailyHistory, buildLeaderboard, getVisibleHistory } from '../src/domain/leaderboard.js';
import { selectActiveTasks } from '../src/domain/tasks.js';
import type { Membership, TaskDefinition, User } from '../src/domain/types.js';
import { createDemoSnapshot } from '../src/data/demoData.js';

const NOW = new Date(2026, 7, 26, 12, 0, 0); // mercredi 26 août 2026, 12:00 locale

const USERS: User[] = [
  { id: 'a', name: 'Ari', initials: 'AR', color: '#264653' },
  { id: 'b', name: 'Béa', initials: 'BE', color: '#2A9D8F' },
];

const MEMBERSHIPS: Membership[] = [
  { householdId: 'h', userId: 'a', role: 'owner', joinedAt: '2026-01-01T00:00:00.000Z' },
  { householdId: 'h', userId: 'b', role: 'member', joinedAt: '2026-01-01T00:00:00.000Z' },
];

function task(id: string, active: boolean): TaskDefinition {
  return {
    id,
    householdId: 'h',
    name: `Tâche ${id}`,
    category: 'other',
    weight: 1,
    active,
    createdAt: NOW.toISOString(),
  };
}

// ——— Onglet Tâches : état vide « Aucune tâche active » ———

test('sélection des tâches actives : liste vide, filtrage et ordre conservés', () => {
  assert.deepEqual(selectActiveTasks([]), []);
  const ordered = selectActiveTasks([task('t1', true), task('t2', false), task('t3', true)]);
  assert.deepEqual(ordered.map((item) => item.id), ['t1', 't3']);
});

test('les données de semis de la démo ne déclenchent jamais l’état vide des tâches', () => {
  const snapshot = createDemoSnapshot(NOW);
  const active = selectActiveTasks(snapshot.tasks);
  assert.ok(active.length > 0);
  assert.equal(active.length, snapshot.tasks.length);
});

// ——— Onglet Historique : état vide « Aucune saisie visible » ———

test('historique sans saisie visible : fenêtres gratuite et complète renvoient une liste vide', () => {
  assert.deepEqual(getVisibleHistory([], 'h', 30, NOW), []);
  assert.deepEqual(getVisibleHistory([], 'h', null, NOW), []);
});

// ——— Onglet Classement : état vide « Pas encore de classement » ———

test('classement sans aucune saisie : membres listés à zéro, condition d’état vide vraie', () => {
  const rows = buildLeaderboard([], USERS, MEMBERSHIPS, 'h', 'week', NOW, false);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.taskCount === 0 && row.value === 0 && row.contribution === 0));
  // Condition exacte utilisée par l'écran pour afficher l'état vide.
  assert.equal(rows.some((row) => row.taskCount > 0), false);
});

// ——— Onglet Historique premium : graphique sans saisie ———

test('graphique quotidien sans saisie : sept jours à zéro, aucun point inventé', () => {
  const points = buildDailyHistory([], 'a', 'h', 7, NOW, false);
  assert.equal(points.length, 7);
  assert.ok(points.every((point) => point.value === 0 && point.taskCount === 0));
});
