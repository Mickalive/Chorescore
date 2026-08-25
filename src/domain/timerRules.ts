import { MAX_DURATION_SECONDS, calculateScore } from './scoring';
import type { AppSnapshot, TaskEntry } from './types';

/**
 * Règles déterministes de reprise après redémarrage.
 *
 * Règle documentée (DRC-02) :
 * - une entrée « in_progress » avec un `startedAt` valide reprend son écoulement
 *   à partir de cette heure de départ, recalculée avec l'horloge de référence
 *   injectée (jamais à partir d'un compteur sérialisé) ;
 * - si l'écart atteint ou dépasse 24 heures (borne haute canonique d'une durée),
 *   l'entrée est clôturée automatiquement : durée plafonnée à 24 h, score calculé
 *   sur cette durée, `completedAt` fixé à départ + 24 h ;
 * - une entrée « in_progress » sans `startedAt` exploitable est clôturée avec une
 *   durée nulle plutôt que laissée dans un état impossible.
 *
 * Aucune donnée n'est perdue silencieusement : chaque intervention produit un
 * événement explicite destiné à être annoncé à la personne.
 */

export type RestartEvent =
  | { kind: 'resumed'; entryId: string }
  | { kind: 'expired'; entryId: string }
  | { kind: 'repaired'; entryId: string };

export const MAX_TIMER_AGE_SECONDS = MAX_DURATION_SECONDS;

export function getElapsedSecondsSince(startedAtIso: string, now: Date): number {
  const startedAt = new Date(startedAtIso);
  if (Number.isNaN(startedAt.getTime())) {
    return Number.NaN;
  }
  return Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
}

/** Durée facturable d'un chrono terminé : plancher 1 s, plafond 24 h. */
export function getCappedDurationSeconds(startedAtIso: string, now: Date): number {
  return Math.max(1, Math.min(MAX_TIMER_AGE_SECONDS, getElapsedSecondsSince(startedAtIso, now)));
}

function isUnparseable(iso: string | null): boolean {
  return iso === null || Number.isNaN(new Date(iso).getTime());
}

export function applyRestartRules(
  snapshot: AppSnapshot,
  now: Date,
): { snapshot: AppSnapshot; events: RestartEvent[] } {
  const events: RestartEvent[] = [];
  let touched = false;

  const entries: TaskEntry[] = snapshot.entries.map((entry) => {
    if (entry.status !== 'in_progress') {
      return entry;
    }
    if (isUnparseable(entry.startedAt)) {
      touched = true;
      events.push({ kind: 'repaired', entryId: entry.id });
      return {
        ...entry,
        status: 'completed',
        completedAt: now.toISOString(),
        durationSeconds: 0,
        score: 0,
      };
    }
    const elapsed = getElapsedSecondsSince(entry.startedAt ?? '', now);
    if (elapsed >= MAX_TIMER_AGE_SECONDS) {
      touched = true;
      const completedAt = new Date(
        new Date(entry.startedAt ?? '').getTime() + MAX_TIMER_AGE_SECONDS * 1000,
      ).toISOString();
      events.push({ kind: 'expired', entryId: entry.id });
      return {
        ...entry,
        status: 'completed',
        completedAt,
        durationSeconds: MAX_TIMER_AGE_SECONDS,
        score: calculateScore(MAX_TIMER_AGE_SECONDS, entry.weightSnapshot),
      };
    }
    // Reprise : l'entrée reste intacte, l'écoulement repart de `startedAt`.
    events.push({ kind: 'resumed', entryId: entry.id });
    return entry;
  });

  return { snapshot: touched ? { ...snapshot, entries } : snapshot, events };
}
