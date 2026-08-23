import { calculateScore } from '../domain/scoring';
import { getIsoWeekKey } from '../domain/periods';
import type { AppSnapshot, TaskDefinition, TaskEntry } from '../domain/types';

const DAY_MS = 24 * 60 * 60 * 1000;

const TASKS: TaskDefinition[] = [
  {
    id: 'task_dishes',
    householdId: 'household_rivage',
    name: 'Vaisselle',
    category: 'dishes',
    weight: 2,
    active: true,
    createdAt: '2026-01-01T10:00:00.000Z',
  },
  {
    id: 'task_cooking',
    householdId: 'household_rivage',
    name: 'Préparer le repas',
    category: 'cooking',
    weight: 3,
    active: true,
    createdAt: '2026-01-01T10:01:00.000Z',
  },
  {
    id: 'task_vacuum',
    householdId: 'household_rivage',
    name: 'Aspirateur',
    category: 'cleaning',
    weight: 3,
    active: true,
    createdAt: '2026-01-01T10:02:00.000Z',
  },
  {
    id: 'task_laundry',
    householdId: 'household_rivage',
    name: 'Lessive',
    category: 'laundry',
    weight: 2,
    active: true,
    createdAt: '2026-01-01T10:03:00.000Z',
  },
  {
    id: 'task_bathroom',
    householdId: 'household_rivage',
    name: 'Salle de bain',
    category: 'cleaning',
    weight: 4,
    active: true,
    createdAt: '2026-01-01T10:04:00.000Z',
  },
];

const ENTRY_SPECS: ReadonlyArray<{
  dayOffset: number;
  userId: string;
  taskId: string;
  durationMinutes: number;
  isManual: boolean;
}> = [
  { dayOffset: 0, userId: 'user_noa', taskId: 'task_dishes', durationMinutes: 18, isManual: false },
  { dayOffset: 0, userId: 'user_camille', taskId: 'task_cooking', durationMinutes: 42, isManual: true },
  { dayOffset: 1, userId: 'user_sam', taskId: 'task_vacuum', durationMinutes: 28, isManual: false },
  { dayOffset: 1, userId: 'user_noa', taskId: 'task_laundry', durationMinutes: 35, isManual: true },
  { dayOffset: 2, userId: 'user_camille', taskId: 'task_dishes', durationMinutes: 16, isManual: false },
  { dayOffset: 2, userId: 'user_sam', taskId: 'task_bathroom', durationMinutes: 31, isManual: true },
  { dayOffset: 3, userId: 'user_noa', taskId: 'task_cooking', durationMinutes: 39, isManual: false },
  { dayOffset: 4, userId: 'user_camille', taskId: 'task_vacuum', durationMinutes: 26, isManual: true },
  { dayOffset: 5, userId: 'user_sam', taskId: 'task_laundry', durationMinutes: 32, isManual: false },
  { dayOffset: 6, userId: 'user_noa', taskId: 'task_bathroom', durationMinutes: 24, isManual: true },
  { dayOffset: 7, userId: 'user_camille', taskId: 'task_cooking', durationMinutes: 45, isManual: false },
  { dayOffset: 9, userId: 'user_sam', taskId: 'task_dishes', durationMinutes: 17, isManual: false },
  { dayOffset: 11, userId: 'user_noa', taskId: 'task_vacuum', durationMinutes: 30, isManual: true },
  { dayOffset: 13, userId: 'user_camille', taskId: 'task_laundry', durationMinutes: 38, isManual: false },
  { dayOffset: 15, userId: 'user_sam', taskId: 'task_cooking', durationMinutes: 41, isManual: true },
  { dayOffset: 18, userId: 'user_noa', taskId: 'task_dishes', durationMinutes: 14, isManual: false },
  { dayOffset: 21, userId: 'user_camille', taskId: 'task_bathroom', durationMinutes: 29, isManual: true },
  { dayOffset: 25, userId: 'user_sam', taskId: 'task_vacuum', durationMinutes: 27, isManual: false },
  { dayOffset: 32, userId: 'user_noa', taskId: 'task_laundry', durationMinutes: 36, isManual: true },
];

function createSeedEntries(now: Date): TaskEntry[] {
  return ENTRY_SPECS.map((spec, index) => {
    const task = TASKS.find((candidate) => candidate.id === spec.taskId);
    if (task === undefined) {
      throw new Error(`Tâche de démonstration inconnue : ${spec.taskId}`);
    }
    const completedAt = new Date(now.getTime() - spec.dayOffset * DAY_MS - (index + 1) * 60_000);
    const durationSeconds = spec.durationMinutes * 60;
    return {
      id: `entry_seed_${index + 1}`,
      taskId: task.id,
      householdId: task.householdId,
      userId: spec.userId,
      status: 'completed',
      startedAt: spec.isManual
        ? null
        : new Date(completedAt.getTime() - durationSeconds * 1000).toISOString(),
      completedAt: completedAt.toISOString(),
      durationSeconds,
      weightSnapshot: task.weight,
      score: calculateScore(durationSeconds, task.weight),
      isManual: spec.isManual,
      periodKey: getIsoWeekKey(completedAt),
    };
  });
}

export function createDemoSnapshot(now = new Date()): AppSnapshot {
  const trialStartedAt = new Date(now.getTime() - 12 * DAY_MS);
  const trialEndsAt = new Date(trialStartedAt.getTime() + 30 * DAY_MS);

  return {
    users: [
      { id: 'user_noa', name: 'Noa', initials: 'NO', color: '#2A9D8F' },
      { id: 'user_camille', name: 'Camille', initials: 'CA', color: '#457B9D' },
      { id: 'user_sam', name: 'Sam', initials: 'SA', color: '#E9C46A' },
    ],
    household: {
      id: 'household_rivage',
      name: 'Foyer Rivage',
      timezone: 'Europe/Zurich',
      plan: 'trial',
      trialStartedAt: trialStartedAt.toISOString(),
      trialEndsAt: trialEndsAt.toISOString(),
      maxMembers: null,
    },
    memberships: [
      {
        householdId: 'household_rivage',
        userId: 'user_noa',
        role: 'owner',
        joinedAt: trialStartedAt.toISOString(),
      },
      {
        householdId: 'household_rivage',
        userId: 'user_camille',
        role: 'member',
        joinedAt: trialStartedAt.toISOString(),
      },
      {
        householdId: 'household_rivage',
        userId: 'user_sam',
        role: 'member',
        joinedAt: trialStartedAt.toISOString(),
      },
    ],
    tasks: TASKS.map((task) => ({ ...task })),
    entries: createSeedEntries(now),
    currentUserId: 'user_noa',
  };
}
