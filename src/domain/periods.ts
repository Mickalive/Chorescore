import type { Period, TaskEntry } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfWeek(date: Date): Date {
  const dayStart = startOfLocalDay(date);
  const day = dayStart.getDay();
  const distanceFromMonday = day === 0 ? 6 : day - 1;
  dayStart.setDate(dayStart.getDate() - distanceFromMonday);
  return dayStart;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getPeriodStart(period: Period, now: Date): Date {
  return period === 'week' ? startOfWeek(now) : startOfMonth(now);
}

export function isEntryInPeriod(entry: TaskEntry, period: Period, now: Date): boolean {
  if (entry.status !== 'completed' || entry.completedAt === null) {
    return false;
  }

  const completedAt = new Date(entry.completedAt);
  const start = getPeriodStart(period, now);
  return completedAt >= start && completedAt <= now;
}

export function getIsoWeekKey(date: Date): string {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utcDate.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function getDaysRemaining(endDate: string, now: Date): number {
  const remaining = new Date(endDate).getTime() - now.getTime();
  return Math.max(0, Math.ceil(remaining / DAY_MS));
}

export function isWithinLastDays(dateIso: string, days: number, now: Date): boolean {
  const date = new Date(dateIso);
  const start = startOfLocalDay(new Date(now.getTime() - (days - 1) * DAY_MS));
  return date >= start && date <= now;
}

export function formatDayLabel(date: Date): string {
  return new Intl.DateTimeFormat('fr-CH', { weekday: 'short' })
    .format(date)
    .replace('.', '');
}

export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-CH', { day: '2-digit', month: 'short' }).format(date);
}
