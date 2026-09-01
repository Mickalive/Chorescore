import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FILTER_ALL,
  FILTER_OTHERS,
  buildMemberBarData,
  buildScoreFilterOptions,
  filterEntriesByTask,
  hasArchivedTaskEntries,
  hasWeightedContent,
} from '../src/domain/scoreFilters.js';
import { calculateScore } from '../src/domain/scoring.js';
import type { TaskDefinition, TaskEntry, User } from '../src/domain/types.js';

const USERS: User[] = [
  { id: 'a', name: 'Ari', initials: 'AR', color: '#2A9D8F' },
  { id: 'b', name: 'Béa', initials: 'BE', color: '#457B9D' },
];

const TASKS: TaskDefinition[] = [
  {
    id: 'task_dishes',
    householdId: 'h',
    name: 'Vaisselle',
    category: 'dishes',
    weight: 2,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'task_cooking',
    householdId: 'h',
    name: 'Cuisine',
    category: 'cooking',
    weight: 3,
    active: true,
    createdAt: '2026-01-01T00:01:00.000Z',
  },
  {
    id: 'task_archived',
    householdId: 'h',
    name: 'Ménage ancien',
    category: 'cleaning',
    weight: 1,
    active: false,
    createdAt: '2026-01-01T00:02:00.000Z',
  },
];

function entry(
  id: string,
  userId: string,
  taskId: string,
  minutes: number,
  weight: number,
): TaskEntry {
  const durationSeconds = minutes * 60;
  return {
    id,
    taskId,
    householdId: 'h',
    userId,
    status: 'completed',
    startedAt: null,
    completedAt: '2026-08-26T10:00:00.000Z',
    durationSeconds,
    weightSnapshot: weight,
    score: calculateScore(durationSeconds, weight),
    isManual: true,
    periodKey: '2026-W35',
  };
}

/* ------------------------------------------------------------------ */
/* buildScoreFilterOptions                                            */
/* ------------------------------------------------------------------ */

test('DRC-03 : les options de filtre incluent Toutes et chaque tâche active', () => {
  const options = buildScoreFilterOptions(TASKS, 'h', false);
  assert.equal(options.length, 3); // Toutes + Vaisselle + Cuisine
  assert.equal(options[0]?.value, FILTER_ALL);
  assert.equal(options[0]?.label, 'Toutes');
  assert.equal(options[1]?.value, 'task_dishes');
  assert.equal(options[1]?.label, 'Vaisselle');
  assert.equal(options[2]?.value, 'task_cooking');
  assert.equal(options[2]?.label, 'Cuisine');
});

test('DRC-03 : l\'option Autres apparaît quand des entrées archivées existent', () => {
  const options = buildScoreFilterOptions(TASKS, 'h', true);
  assert.equal(options.length, 4);
  assert.equal(options[3]?.value, FILTER_OTHERS);
  assert.equal(options[3]?.label, 'Autres');
});

test('DRC-03 : les tâches d\'un autre foyer ne figurent pas dans les options', () => {
  const otherTask: TaskDefinition = {
    id: 'task_dishes_other',
    householdId: 'other',
    name: 'Vaisselle',
    category: 'dishes',
    weight: 2,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  const options = buildScoreFilterOptions([otherTask], 'h', false);
  assert.equal(options.length, 1); // Only Toutes
  assert.equal(options[0]?.value, FILTER_ALL);
});

/* ------------------------------------------------------------------ */
/* filterEntriesByTask                                                */
/* ------------------------------------------------------------------ */

test('DRC-03 : FILTRE Toutes retourne toutes les entrées complétées', () => {
  const entries = [
    entry('1', 'a', 'task_dishes', 10, 1),
    entry('2', 'b', 'task_cooking', 20, 1),
  ];
  const filtered = filterEntriesByTask(entries, TASKS, 'h', FILTER_ALL);
  assert.equal(filtered.length, 2);
});

test('DRC-03 : un filtre par taskId ne garde que les entrées correspondantes', () => {
  const entries = [
    entry('1', 'a', 'task_dishes', 10, 1),
    entry('2', 'b', 'task_cooking', 20, 1),
    entry('3', 'a', 'task_dishes', 15, 1),
  ];
  const filtered = filterEntriesByTask(entries, TASKS, 'h', 'task_dishes');
  assert.equal(filtered.length, 2);
  assert.ok(filtered.every((e) => e.taskId === 'task_dishes'));
});

test('DRC-03 : le filtre Autres garde les entrées dont le taskId est archivé', () => {
  const entries = [
    entry('1', 'a', 'task_dishes', 10, 1),
    entry('2', 'b', 'task_archived', 20, 1),
    entry('3', 'a', 'task_cooking', 15, 1),
  ];
  const filtered = filterEntriesByTask(entries, TASKS, 'h', FILTER_OTHERS);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.taskId, 'task_archived');
});

test('DRC-03 : le filtre Autres ne retourne rien si aucune tâche archivée n\'est liée', () => {
  const entries = [
    entry('1', 'a', 'task_dishes', 10, 1),
    entry('2', 'b', 'task_cooking', 20, 1),
  ];
  const filtered = filterEntriesByTask(entries, TASKS, 'h', FILTER_OTHERS);
  assert.equal(filtered.length, 0);
});

/* ------------------------------------------------------------------ */
/* hasArchivedTaskEntries                                             */
/* ------------------------------------------------------------------ */

test('DRC-03 : hasArchivedTaskEntries détecte les entrées liées à des tâches archivées', () => {
  const entries = [entry('1', 'a', 'task_archived', 10, 1)];
  assert.equal(hasArchivedTaskEntries(entries, TASKS, 'h'), true);
});

test('DRC-03 : hasArchivedTaskEntries retourne false sans entrées archivées', () => {
  const entries = [entry('1', 'a', 'task_dishes', 10, 1)];
  assert.equal(hasArchivedTaskEntries(entries, TASKS, 'h'), false);
});

/* ------------------------------------------------------------------ */
/* buildMemberBarData                                                 */
/* ------------------------------------------------------------------ */

test('DRC-03 : buildMemberBarData retourne les membres triés par minutes décroissantes', () => {
  const entries = [
    entry('1', 'a', 'task_dishes', 30, 1),
    entry('2', 'b', 'task_cooking', 20, 1),
    entry('3', 'a', 'task_cooking', 10, 1),
  ];
  const data = buildMemberBarData(entries, USERS, 'h', false);
  assert.equal(data.length, 2);
  // Ari: 40 min, Béa: 20 min
  assert.equal(data[0]?.user.id, 'a');
  assert.equal(data[0]?.minutes, 40);
  assert.equal(data[0]?.entryCount, 2);
  assert.equal(data[1]?.user.id, 'b');
  assert.equal(data[1]?.minutes, 20);
  assert.equal(data[1]?.entryCount, 1);
});

test('DRC-03 : buildMemberBarData ignore les entrées d\'un autre foyer', () => {
  const entries = [
    entry('1', 'a', 'task_dishes', 30, 1),
    { ...entry('2', 'b', 'task_cooking', 20, 1), householdId: 'other' },
  ];
  const data = buildMemberBarData(entries, USERS, 'h', false);
  assert.equal(data.length, 1);
  assert.equal(data[0]?.user.id, 'a');
});

test('DRC-03 : buildMemberBarData avec useWeights=true utilise le score pondéré', () => {
  const entries = [
    entry('1', 'a', 'task_dishes', 30, 2), // score = 60
    entry('2', 'b', 'task_cooking', 20, 1), // score = 20
  ];
  const data = buildMemberBarData(entries, USERS, 'h', true);
  assert.equal(data[0]?.value, 60);
  assert.equal(data[1]?.value, 20);
});

test('DRC-03 : buildMemberBarData retourne une liste vide sans entrées', () => {
  const data = buildMemberBarData([], USERS, 'h', false);
  assert.equal(data.length, 0);
});

/* ------------------------------------------------------------------ */
/* hasWeightedContent                                                 */
/* ------------------------------------------------------------------ */

test('DRC-03 : hasWeightedContent retourne true si au moins un weight ≠ 1', () => {
  const entries = [
    entry('1', 'a', 'task_dishes', 10, 1),
    entry('2', 'b', 'task_cooking', 10, 2),
  ];
  assert.equal(hasWeightedContent(entries), true);
});

test('DRC-03 : hasWeightedContent retourne false si tous les weights sont 1', () => {
  const entries = [
    entry('1', 'a', 'task_dishes', 10, 1),
    entry('2', 'b', 'task_cooking', 10, 1),
  ];
  assert.equal(hasWeightedContent(entries), false);
});

test('DRC-03 : hasWeightedContent retourne false pour une liste vide', () => {
  assert.equal(hasWeightedContent([]), false);
});
