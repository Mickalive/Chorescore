import { isEntryInPeriod } from './periods';
import { getEntryValue } from './scoring';
import type { Period, TaskDefinition, TaskEntry } from './types';

/**
 * Filtres de l'onglet Historique. Contrairement au classement mensuel, ces
 * filtres ne sont pas une analyse avancée : ils naviguent la liste déjà
 * visible (fenêtre de 30 jours en gratuit). Ils restent donc accessibles à
 * tous les plans et ne déclenchent jamais de paywall.
 */
export type HistoryPeriodFilter = 'all' | Period;

export type TaskBreakdownRow = {
  taskId: string;
  /** Nom de la tâche ; « Tâche archivée » si la définition n'existe plus. */
  label: string;
  minutes: number;
  value: number;
  entryCount: number;
};

export type HistorySynthesis = {
  totalMinutes: number;
  totalValue: number;
  entryCount: number;
  byTask: TaskBreakdownRow[];
};

/**
 * Filtre une liste déjà visible (voir `getVisibleHistory`) par période et par
 * membre. Frontières locales documentées : la semaine démarre le lundi 00:00
 * de l'appareil (`startOfWeek`) et le mois le 1er 00:00 local
 * (`startOfMonth`), la même base que les périodes du classement. Une entrée
 * est incluse quand `début de période <= completedAt <= now` ; en production,
 * l'heure de référence doit venir du serveur (canon), la démo utilise
 * l'horloge locale.
 */
export function filterHistoryEntries(
  entries: TaskEntry[],
  period: HistoryPeriodFilter,
  userId: string | null,
  now: Date,
): TaskEntry[] {
  return entries.filter((entry) => {
    if (userId !== null && entry.userId !== userId) {
      return false;
    }
    if (period === 'all') {
      return true;
    }
    return isEntryInPeriod(entry, period, now);
  });
}

/**
 * Synthèse factuelle d'une sélection : total de minutes, valeur totale et
 * répartition par tâche. Aucun arrondi métier ici (l'arrondi est réservé à
 * l'affichage) ; aucune comparaison entre membres dans ce module, pour rester
 * dans un ton descriptif et non culpabilisant.
 *
 * Déterminisme : `byTask` est trié par minutes décroissantes, puis libellé
 * (collation « fr »), puis identifiant de tâche — deux exécutions sur les
 * mêmes données produisent le même ordre, y compris pour deux tâches
 * archivées partageant le même libellé de repli.
 */
export function buildHistorySynthesis(
  entries: TaskEntry[],
  tasks: TaskDefinition[],
  useWeights: boolean,
): HistorySynthesis {
  const taskNames = new Map(tasks.map((task) => [task.id, task.name]));
  const totals = new Map<string, TaskBreakdownRow>();
  let totalMinutes = 0;
  let totalValue = 0;

  for (const entry of entries) {
    const minutes = entry.durationSeconds / 60;
    const value = getEntryValue(entry, useWeights);
    totalMinutes += minutes;
    totalValue += value;

    const existing = totals.get(entry.taskId);
    if (existing === undefined) {
      totals.set(entry.taskId, {
        taskId: entry.taskId,
        label: taskNames.get(entry.taskId) ?? 'Tâche archivée',
        minutes,
        value,
        entryCount: 1,
      });
    } else {
      existing.minutes += minutes;
      existing.value += value;
      existing.entryCount += 1;
    }
  }

  const byTask = [...totals.values()].sort(
    (a, b) =>
      b.minutes - a.minutes ||
      a.label.localeCompare(b.label, 'fr') ||
      a.taskId.localeCompare(b.taskId),
  );

  return {
    totalMinutes,
    totalValue,
    entryCount: entries.length,
    byTask,
  };
}
