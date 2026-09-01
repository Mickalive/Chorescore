/**
 * DRC-05 : constructeurs de texte pour le partage.
 *
 * Fonctions pures sans dépendance React Native, testables en Node.js.
 */

/**
 * Formate une durée en minutes vers un libellé humain readable.
 * 0 → "0 min", 60 → "1 h", 90 → "1 h 30", 125 → "2 h 5".
 */
export function formatDurationHuman(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m}`;
}

/**
 * Construit le texte de partage pour le Score courant (période + filtre +
 * équilibres). Le format est informatif et ne contient aucun commentaire
 * moral ou relationnel.
 */
export function buildScoreShareText(opts: {
  householdName: string;
  periodLabel: string;
  filterLabel: string;
  totalMinutes: number;
  rows: ReadonlyArray<{
    name: string;
    durationMinutes: number;
    rank: number;
  }>;
}): string {
  const lines: string[] = [];
  lines.push(`ChoreScore — ${opts.householdName}`);
  lines.push(`Période : ${opts.periodLabel} · Filtre : ${opts.filterLabel}`);
  lines.push(`Temps total : ${formatDurationHuman(opts.totalMinutes)}`);
  lines.push('');
  for (const row of opts.rows) {
    lines.push(`#${row.rank} ${row.name} : ${formatDurationHuman(row.durationMinutes)}`);
  }
  lines.push('');
  lines.push('#ChargeMentale');
  return lines.join('\n');
}

/**
 * Construit le texte de partage pour une entrée du journal.
 */
export function buildEntryShareText(opts: {
  taskName: string;
  durationMinutes: number;
  performedBy: string;
  date: string;
}): string {
  return [
    `ChoreScore`,
    `${opts.taskName} — ${formatDurationHuman(opts.durationMinutes)}`,
    `Fait par ${opts.performedBy} · ${opts.date}`,
    '',
    '#ChargeMentale',
  ].join('\n');
}

/**
 * Construit le texte de partage pour une To-do.
 */
export function buildTodoShareText(opts: {
  label: string;
  assigneeName: string | null;
  dueDate: string | null;
  note: string;
}): string {
  const lines: string[] = [];
  lines.push('ChoreScore — Tâche à venir');
  lines.push(opts.label);
  if (opts.assigneeName !== null) lines.push(`Assigné à ${opts.assigneeName}`);
  if (opts.dueDate !== null) lines.push(`Échéance : ${opts.dueDate}`);
  if (opts.note.length > 0) lines.push(`Note : ${opts.note}`);
  lines.push('');
  lines.push('#ChargeMentale');
  return lines.join('\n');
}
