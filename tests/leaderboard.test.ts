import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDailyHistory, buildLeaderboard, getVisibleHistory } from '../src/domain/leaderboard.js';
import { calculateScore } from '../src/domain/scoring.js';
import type { Membership, TaskEntry, User } from '../src/domain/types.js';

const USERS: User[] = [
  { id: 'a', name: 'Ari', initials: 'AR', color: '#000000' },
  { id: 'b', name: 'Béa', initials: 'BE', color: '#111111' },
];

const MEMBERSHIPS: Membership[] = [
  { householdId: 'h', userId: 'a', role: 'owner', joinedAt: '2026-01-01T00:00:00.000Z' },
  { householdId: 'h', userId: 'b', role: 'member', joinedAt: '2026-01-01T00:00:00.000Z' },
];

function entry(id: string, userId: string, completedAt: string, minutes: number, weight: number): TaskEntry {
  const durationSeconds = minutes * 60;
  return {
    id,
    taskId: 'task',
    householdId: 'h',
    userId,
    status: 'completed',
    startedAt: null,
    completedAt,
    durationSeconds,
    weightSnapshot: weight,
    score: calculateScore(durationSeconds, weight),
    isManual: true,
    periodKey: '2026-W35',
  };
}

test('le leaderboard pondéré calcule rang et contribution', () => {
  const now = new Date(2026, 7, 26, 12, 0, 0);
  const entries = [
    entry('1', 'a', new Date(2026, 7, 25, 10, 0, 0).toISOString(), 30, 2),
    entry('2', 'b', new Date(2026, 7, 25, 11, 0, 0).toISOString(), 20, 1),
  ];
  const rows = buildLeaderboard(entries, USERS, MEMBERSHIPS, 'h', 'week', now, true);
  assert.equal(rows[0]?.user.id, 'a');
  assert.equal(rows[0]?.value, 60);
  assert.equal(rows[0]?.contribution, 75);
  assert.equal(rows[1]?.rank, 2);
});

test('le leaderboard gratuit compare le temps brut', () => {
  const now = new Date(2026, 7, 26, 12, 0, 0);
  const entries = [
    entry('1', 'a', new Date(2026, 7, 25, 10, 0, 0).toISOString(), 10, 10),
    entry('2', 'b', new Date(2026, 7, 25, 11, 0, 0).toISOString(), 20, 1),
  ];
  const rows = buildLeaderboard(entries, USERS, MEMBERSHIPS, 'h', 'week', now, false);
  assert.equal(rows[0]?.user.id, 'b');
  assert.equal(rows[0]?.value, 20);
});

test('l’historique quotidien crée aussi les jours vides', () => {
  const now = new Date(2026, 7, 26, 12, 0, 0);
  const entries = [entry('1', 'a', new Date(2026, 7, 26, 10, 0, 0).toISOString(), 10, 2)];
  const points = buildDailyHistory(entries, 'a', 'h', 7, now, true);
  assert.equal(points.length, 7);
  assert.equal(points.at(-1)?.value, 20);
  assert.equal(points.filter((point) => point.value === 0).length, 6);
});

test('la fenêtre gratuite masque les entrées antérieures à 30 jours', () => {
  const now = new Date(2026, 7, 26, 12, 0, 0);
  const entries = [
    entry('recent', 'a', new Date(2026, 7, 1, 10, 0, 0).toISOString(), 10, 1),
    entry('old', 'a', new Date(2026, 6, 1, 10, 0, 0).toISOString(), 10, 1),
  ];
  assert.deepEqual(getVisibleHistory(entries, 'h', 30, now).map((item) => item.id), ['recent']);
  assert.equal(getVisibleHistory(entries, 'h', null, now).length, 2);
});
