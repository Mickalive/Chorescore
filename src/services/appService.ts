import type { AppSnapshot, TaskCategory, TaskDefinition, TaskEntry } from '../domain/types';

export type CreateTaskInput = {
  householdId: string;
  name: string;
  category: TaskCategory;
  weight: number;
  now: Date;
};

export type StartTimerInput = {
  householdId: string;
  userId: string;
  task: TaskDefinition;
  effectiveWeight: number;
  now: Date;
};

export type CompleteTimerInput = {
  entry: TaskEntry;
  now: Date;
};

export type ManualEntryInput = {
  householdId: string;
  userId: string;
  task: TaskDefinition;
  effectiveWeight: number;
  durationMinutes: number;
  now: Date;
};

export interface AppDataService {
  readonly mode: 'demo' | 'production-disabled';
  getInitialSnapshot(now?: Date): AppSnapshot;
  createTask(input: CreateTaskInput): TaskDefinition;
  startTimer(input: StartTimerInput): TaskEntry;
  completeTimer(input: CompleteTimerInput): TaskEntry;
  createManualEntry(input: ManualEntryInput): TaskEntry;
}

export class ProductionModeDisabledError extends Error {
  constructor() {
    super('Le service de production est volontairement désactivé dans cette démo.');
    this.name = 'ProductionModeDisabledError';
  }
}
