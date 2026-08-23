import { getEntryValue } from './scoring';
import { isEntryInPeriod, isWithinLastDays, startOfLocalDay } from './periods';
import type { Membership, Period, TaskEntry, User } from './types';

export type LeaderboardRow = {
  user: User;
  rank: number;
  value: number;
  durationMinutes: number;
  taskCount: number;
  contribution: number;
};

export function buildLeaderboard(
  entries: TaskEntry[],
  users: User[],
  memberships: Membership[],
  householdId: string,
  period: Period,
  now: Date,
  useWeights: boolean,
): LeaderboardRow[] {
  const memberIds = new Set(
    memberships.filter((membership) => membership.householdId === householdId).map((item) => item.userId),
  );
  const relevantEntries = entries.filter(
    (entry) =>
      entry.householdId === householdId &&
      memberIds.has(entry.userId) &&
      isEntryInPeriod(entry, period, now),
  );

  const unsorted = users
    .filter((user) => memberIds.has(user.id))
    .map((user) => {
      const userEntries = relevantEntries.filter((entry) => entry.userId === user.id);
      return {
        user,
        rank: 0,
        value: userEntries.reduce((sum, entry) => sum + getEntryValue(entry, useWeights), 0),
        durationMinutes: userEntries.reduce((sum, entry) => sum + entry.durationSeconds / 60, 0),
        taskCount: userEntries.length,
        contribution: 0,
      };
    })
    .sort((a, b) => b.value - a.value || a.user.name.localeCompare(b.user.name, 'fr'));

  const total = unsorted.reduce((sum, row) => sum + row.value, 0);
  let previousValue: number | null = null;
  let currentRank = 0;

  return unsorted.map((row, index) => {
    if (previousValue === null || Math.abs(row.value - previousValue) > Number.EPSILON) {
      currentRank = index + 1;
      previousValue = row.value;
    }
    return {
      ...row,
      rank: currentRank,
      contribution: total === 0 ? 0 : (row.value / total) * 100,
    };
  });
}

export type HistoryPoint = {
  key: string;
  label: string;
  value: number;
  taskCount: number;
};

export function buildDailyHistory(
  entries: TaskEntry[],
  userId: string,
  householdId: string,
  days: number,
  now: Date,
  useWeights: boolean,
): HistoryPoint[] {
  const result: HistoryPoint[] = [];
  const today = startOfLocalDay(now);

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const dailyEntries = entries.filter((entry) => {
      if (
        entry.userId !== userId ||
        entry.householdId !== householdId ||
        entry.status !== 'completed' ||
        entry.completedAt === null
      ) {
        return false;
      }
      const completedAt = new Date(entry.completedAt);
      return completedAt >= date && completedAt < nextDate;
    });

    result.push({
      key: date.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat('fr-CH', { weekday: 'short' }).format(date).replace('.', ''),
      value: dailyEntries.reduce((sum, entry) => sum + getEntryValue(entry, useWeights), 0),
      taskCount: dailyEntries.length,
    });
  }

  return result;
}

export function getVisibleHistory(
  entries: TaskEntry[],
  householdId: string,
  historyDays: number | null,
  now: Date,
): TaskEntry[] {
  return entries
    .filter(
      (entry) =>
        entry.householdId === householdId &&
        entry.status === 'completed' &&
        entry.completedAt !== null &&
        (historyDays === null || isWithinLastDays(entry.completedAt, historyDays, now)),
    )
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
}
