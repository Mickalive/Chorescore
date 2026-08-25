import { createDemoSnapshot } from '../data/demoData';
import { calculateScore } from '../domain/scoring';
import { getIsoWeekKey } from '../domain/periods';
import { getCappedDurationSeconds } from '../domain/timerRules';
import { normalizeTaskName } from '../domain/validation';
import type {
  AppDataService,
  CompleteTimerInput,
  CreateTaskInput,
  EditEntryDurationInput,
  ManualEntryInput,
  StartTimerInput,
  UpdateTaskInput,
} from './appService';

let sequence = 0;

function createDemoId(prefix: string, now: Date): string {
  sequence += 1;
  return `${prefix}_${now.getTime()}_${sequence}`;
}

export class DemoAppService implements AppDataService {
  readonly mode = 'demo' as const;

  getInitialSnapshot(now = new Date()) {
    return createDemoSnapshot(now);
  }

  createTask(input: CreateTaskInput) {
    return {
      id: createDemoId('task', input.now),
      householdId: input.householdId,
      name: normalizeTaskName(input.name),
      category: input.category,
      weight: input.weight,
      active: true,
      createdAt: input.now.toISOString(),
    };
  }

  startTimer(input: StartTimerInput) {
    return {
      id: createDemoId('entry', input.now),
      taskId: input.task.id,
      householdId: input.householdId,
      userId: input.userId,
      status: 'in_progress' as const,
      startedAt: input.now.toISOString(),
      completedAt: null,
      durationSeconds: 0,
      weightSnapshot: input.effectiveWeight,
      score: 0,
      isManual: false,
      periodKey: getIsoWeekKey(input.now),
    };
  }

  completeTimer(input: CompleteTimerInput) {
    if (input.entry.startedAt === null) {
      throw new Error('Un chrono actif doit posséder une heure de départ.');
    }
    const elapsedSeconds = getCappedDurationSeconds(input.entry.startedAt, input.now);
    return {
      ...input.entry,
      status: 'completed' as const,
      completedAt: input.now.toISOString(),
      durationSeconds: elapsedSeconds,
      score: calculateScore(elapsedSeconds, input.entry.weightSnapshot),
      periodKey: getIsoWeekKey(input.now),
    };
  }

  createManualEntry(input: ManualEntryInput) {
    const durationSeconds = input.durationMinutes * 60;
    return {
      id: createDemoId('entry', input.now),
      taskId: input.task.id,
      householdId: input.householdId,
      userId: input.userId,
      status: 'completed' as const,
      startedAt: null,
      completedAt: input.now.toISOString(),
      durationSeconds,
      weightSnapshot: input.effectiveWeight,
      score: calculateScore(durationSeconds, input.effectiveWeight),
      isManual: true,
      periodKey: getIsoWeekKey(input.now),
    };
  }

  /**
   * Mise à jour d'une tâche (DRC-03) : seul le descriptif courant change.
   * L'identifiant, le foyer, la date de création et le statut actif sont
   * conservés ; les entrées existantes ne sont jamais touchées ici, leurs
   * `weightSnapshot` et scores restent figés (canon produit).
   */
  updateTask(input: UpdateTaskInput) {
    return {
      ...input.task,
      name: normalizeTaskName(input.name),
      category: input.category,
      weight: input.weight,
    };
  }

  /**
   * Correction de la durée d'une entrée terminée (DRC-03) : le score est
   * recalculé exclusivement depuis le `weightSnapshot` figé à la validation
   * initiale, jamais depuis le poids courant de la tâche. La date de fin, la
   * période et l'origine de l'entrée restent inchangées : corriger une durée
   * modifie la quantité de temps, pas le moment où elle a eu lieu.
   */
  editCompletedEntryDuration(input: EditEntryDurationInput) {
    if (input.entry.status !== 'completed') {
      throw new Error('Seule une entrée terminée peut être corrigée.');
    }
    const durationSeconds = input.durationMinutes * 60;
    return {
      ...input.entry,
      durationSeconds,
      score: calculateScore(durationSeconds, input.entry.weightSnapshot),
    };
  }
}
