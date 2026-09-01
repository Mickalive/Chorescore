import { getEntryValue } from './scoring';
import type { TaskDefinition, TaskEntry, User } from './types';

/* ------------------------------------------------------------------ */
/* Score task filter (DRC-03)                                          */
/* ------------------------------------------------------------------ */

/**
 * Identifiant canonique du filtre « Autres » dans le sélecteur Score.
 * Les entrées dont le taskId ne correspond à aucune TaskDefinition active
 * du foyer sont regroupées sous ce filtre.
 */
export const FILTER_ALL = 'all';
export const FILTER_OTHERS = 'others';

export type ScoreTaskFilter = string; // FILTER_ALL | FILTER_OTHERS | taskId

export type ScoreFilterOption = {
  value: string;
  label: string;
};

/**
 * Construit les options du sélecteur de filtres Score :
 * - « Toutes »
 * - une entrée par TaskDefinition active du foyer
 * - « Autres » (si au moins une tâche archivée existe)
 *
 * L'ordre suit celui du store (ajouts récents d'abord), ce qui correspond
 * à l'ordre d'affichage dans l'écran Tâches.
 */
export function buildScoreFilterOptions(
  tasks: readonly TaskDefinition[],
  householdId: string,
  archivedEntriesExist: boolean,
): ScoreFilterOption[] {
  const activeTasks = tasks.filter(
    (task) => task.active && task.householdId === householdId,
  );

  const options: ScoreFilterOption[] = [
    { value: FILTER_ALL, label: 'Toutes' },
    ...activeTasks.map((task) => ({ value: task.id, label: task.name })),
  ];

  if (archivedEntriesExist) {
    options.push({ value: FILTER_OTHERS, label: 'Autres' });
  }

  return options;
}

/**
 * Filtre les entrées par filtre Score sélectionné.
 *
 * - FILTER_ALL : toutes les entrées de la période
 * - FILTER_OTHERS : entrées dont le taskId ne correspond à aucune tâche active
 * - autre valeur : taskId exact
 *
 * Les entrées non terminées (in_progress) sont toujours exclues.
 */
export function filterEntriesByTask(
  entries: TaskEntry[],
  tasks: readonly TaskDefinition[],
  householdId: string,
  filter: ScoreTaskFilter,
): TaskEntry[] {
  if (filter === FILTER_ALL) {
    return entries;
  }

  if (filter === FILTER_OTHERS) {
    const activeTaskIds = new Set(
      tasks
        .filter((task) => task.active && task.householdId === householdId)
        .map((task) => task.id),
    );
    return entries.filter((entry) => !activeTaskIds.has(entry.taskId));
  }

  // Filtre par taskId spécifique
  return entries.filter((entry) => entry.taskId === filter);
}

/**
 * Vérifie si des entrées archivées (dont le taskId ne pointe vers aucune
 * tâche active du foyer) existent dans la liste fournie. Utilisé pour
 * décider si l'option « Autres » doit apparaître dans le sélecteur.
 */
export function hasArchivedTaskEntries(
  entries: readonly TaskEntry[],
  tasks: readonly TaskDefinition[],
  householdId: string,
): boolean {
  const activeTaskIds = new Set(
    tasks
      .filter((task) => task.active && task.householdId === householdId)
      .map((task) => task.id),
  );
  return entries.some(
    (entry) =>
      entry.householdId === householdId &&
      entry.status === 'completed' &&
      !activeTaskIds.has(entry.taskId),
  );
}

/* ------------------------------------------------------------------ */
/* Member bar data (DRC-03)                                           */
/* ------------------------------------------------------------------ */

export type MemberBarDatum = {
  user: User;
  minutes: number;
  value: number;
  entryCount: number;
};

/**
 * Prépare les données du graphique à barres par membre : temps total et
 * valeur (pondérée ou non) pour chaque membre du foyer, à partir des
 * entrées filtrées. L'ordre suit les minutes décroissantes puis le nom
 * pour un rendu déterministe.
 */
export function buildMemberBarData(
  entries: TaskEntry[],
  users: User[],
  householdId: string,
  useWeights: boolean,
): MemberBarDatum[] {
  const totals = new Map<string, { minutes: number; value: number; entryCount: number }>();

  for (const entry of entries) {
    if (entry.householdId !== householdId || entry.status !== 'completed') continue;

    const existing = totals.get(entry.userId);
    const minutes = entry.durationSeconds / 60;
    const value = getEntryValue(entry, useWeights);

    if (existing === undefined) {
      totals.set(entry.userId, { minutes, value, entryCount: 1 });
    } else {
      existing.minutes += minutes;
      existing.value += value;
      existing.entryCount += 1;
    }
  }

  const memberById = new Map(users.map((user) => [user.id, user]));

  return [...totals.entries()]
    .map(([userId, data]) => ({
      user: memberById.get(userId) ?? { id: userId, name: userId, initials: '??', color: '#999' },
      minutes: data.minutes,
      value: data.value,
      entryCount: data.entryCount,
    }))
    .sort((a, b) => b.minutes - a.minutes || a.user.name.localeCompare(b.user.name, 'fr'));
}

/**
 * Nombre total de minutes pondérées (tous membres confondus) pour
 * déterminer si une vue pondérée secondaire doit être affichée.
 * Si toutes les entrées ont un weight de 1, la vue pondérée n'apporte
 * rien et ne doit pas être rendue.
 */
export function hasWeightedContent(entries: readonly TaskEntry[]): boolean {
  return entries.some((entry) => entry.weightSnapshot !== 1);
}
