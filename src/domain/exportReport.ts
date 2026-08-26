import { buildHistorySynthesis, describePeriodBounds, type HistoryPeriodFilter } from './history';
import { formatMetric, getEntryValue } from './scoring';
import type { TaskDefinition, TaskEntry, User } from './types';

/**
 * Rapport d'historique local (DRC-04).
 *
 * L'export de démonstration produit un contenu réellement consultable : un
 * texte intégral construit depuis les entrées filtrées du foyer actif,
 * présenté à l'écran et partageable via la feuille de partage du système.
 * Aucun réseau, aucun compte, aucune prétention de synchronisation : le
 * fichier naît et reste sur l'appareil.
 *
 * Déterminisme : mêmes entrées + même instant => texte et nom de fichier
 * identiques. Les totaux sont calculés par `buildHistorySynthesis` (même
 * mathématique que l'écran) ; l'arrondi est réservé à l'affichage.
 */

export type HistoryReportInput = {
  householdName: string;
  planLabel: string;
  period: HistoryPeriodFilter;
  /** Libellé du filtre membre ; null = tout le foyer. */
  memberLabel: string | null;
  entries: TaskEntry[];
  tasks: TaskDefinition[];
  users: User[];
  useWeights: boolean;
  generatedAt: Date;
};

export type HistoryReport = {
  fileName: string;
  text: string;
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Nom de fichier déterministe, horloge locale de l'appareil. */
export function buildHistoryFileName(generatedAt: Date): string {
  const date = `${generatedAt.getFullYear()}${pad2(generatedAt.getMonth() + 1)}${pad2(generatedAt.getDate())}`;
  const time = `${pad2(generatedAt.getHours())}${pad2(generatedAt.getMinutes())}`;
  return `rapport-chorescore-${date}-${time}.txt`;
}

function formatEntryTimestamp(entry: TaskEntry): string {
  if (entry.completedAt === null) {
    return 'sans date';
  }
  return formatLocalTimestamp(new Date(entry.completedAt));
}

function formatLocalTimestamp(date: Date): string {
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function buildHistoryReport(input: HistoryReportInput): HistoryReport {
  const synthesis = buildHistorySynthesis(input.entries, input.tasks, input.useWeights);
  const unit = input.useWeights ? 'pts' : 'min';
  const bounds = describePeriodBounds(input.period, input.generatedAt);
  const userNames = new Map(input.users.map((user) => [user.id, user.name]));

  const lines: string[] = [
    'ChoreScore — Rapport d’historique',
    'Démo hors ligne : contenu généré sur cet appareil, sans envoi réseau ni synchronisation.',
    '',
    `Foyer : ${input.householdName}`,
    `Scénario : ${input.planLabel}`,
    `Généré le : ${formatLocalTimestamp(input.generatedAt)}`,
    `Période : ${bounds ?? 'fenêtre visible complète'}`,
    `Membre : ${input.memberLabel ?? 'tout le foyer'}`,
    '',
    'Totaux de la sélection',
    `- Temps saisi : ${Math.round(synthesis.totalMinutes)} min`,
    `- Valeur (${input.useWeights ? 'durée × poids convenu' : 'temps brut, poids effectif 1'}) : ${formatMetric(synthesis.totalValue, input.useWeights)}`,
    `- Entrées : ${synthesis.entryCount}`,
    '- Méthode : somme des durées des entrées terminées de la sélection ; l’arrondi est réservé à l’affichage.',
    '',
    'Répartition par tâche',
  ];

  if (synthesis.byTask.length === 0) {
    lines.push('(aucune tâche dans cette sélection)');
  } else {
    for (const row of synthesis.byTask) {
      lines.push(`- ${row.label} : ${Math.round(row.minutes)} min · ${row.entryCount} saisie${row.entryCount > 1 ? 's' : ''} · ${formatMetric(row.value, input.useWeights)}`);
    }
  }

  lines.push('', `Entrées (${synthesis.entryCount}) — de la plus récente à la plus ancienne`);
  if (input.entries.length === 0) {
    lines.push('Aucune entrée dans cette sélection.');
  } else {
    const sorted = [...input.entries].sort(
      (a, b) =>
        (b.completedAt ?? '').localeCompare(a.completedAt ?? '') || a.id.localeCompare(b.id),
    );
    for (const entry of sorted) {
      const label =
        input.tasks.find((task) => task.id === entry.taskId)?.name ?? 'Tâche archivée';
      const who = userNames.get(entry.userId) ?? 'Membre';
      lines.push(
        `- ${formatEntryTimestamp(entry)} · ${who} · ${label} · ${Math.round(entry.durationSeconds / 60)} min · ${formatMetric(getEntryValue(entry, input.useWeights), input.useWeights)}`,
      );
    }
  }

  lines.push(
    '',
    `Unité : ${unit}. Ces données restent la propriété des personnes qui les ont créées.`,
  );

  return { fileName: buildHistoryFileName(input.generatedAt), text: lines.join('\n') };
}
