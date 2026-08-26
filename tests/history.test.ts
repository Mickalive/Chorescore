import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHistorySynthesis, describePeriodBounds, filterHistoryEntries } from '../src/domain/history.js';
import { getPeriodStart } from '../src/domain/periods.js';
import { getVisibleHistory } from '../src/domain/leaderboard.js';
import { calculateScore } from '../src/domain/scoring.js';
import { createDemoSnapshot } from '../src/data/demoData.js';
import type { TaskDefinition, TaskEntry } from '../src/domain/types.js';

const NOW = new Date(2026, 7, 26, 12, 0, 0); // mercredi 26 août 2026, 12:00 locale
// Semaine locale : lundi 24 août 00:00 → dimanche 30 août.
// Mois local : samedi 1er août 00:00 → lundi 31 août.

const TASKS: TaskDefinition[] = [
  {
    id: 'task_dishes',
    householdId: 'h',
    name: 'Vaisselle',
    category: 'dishes',
    weight: 2,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'task_cooking',
    householdId: 'h',
    name: 'Préparer le repas',
    category: 'cooking',
    weight: 3,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

function entry(
  id: string,
  userId: string,
  completedAt: Date,
  minutes: number,
  weight = 1,
  taskId = 'task_dishes',
): TaskEntry {
  const durationSeconds = minutes * 60;
  return {
    id,
    taskId,
    householdId: 'h',
    userId,
    status: 'completed',
    startedAt: null,
    completedAt: completedAt.toISOString(),
    durationSeconds,
    weightSnapshot: weight,
    score: calculateScore(durationSeconds, weight),
    isManual: true,
    periodKey: 'test-week',
  };
}

test('la synthèse hebdomadaire totalise les minutes et répartit par tâche', () => {
  const entries = [
    entry('e1', 'a', new Date(2026, 7, 24, 9, 0, 0), 30, 2), // lundi
    entry('e2', 'b', new Date(2026, 7, 25, 20, 0, 0), 20, 3, 'task_cooking'),
    entry('e3', 'a', new Date(2026, 7, 25, 21, 0, 0), 15, 2),
  ];
  const filtered = filterHistoryEntries(entries, 'week', null, NOW);
  assert.equal(filtered.length, 3);

  const synthesis = buildHistorySynthesis(filtered, TASKS, true);
  assert.equal(synthesis.entryCount, 3);
  assert.equal(synthesis.totalMinutes, 65);
  // Valeurs pondérées : (30 × 2) + (20 × 3) + (15 × 2)
  assert.equal(synthesis.totalValue, 150);
  assert.deepEqual(
    synthesis.byTask.map((row) => [row.label, row.minutes, row.entryCount]),
    [
      ['Vaisselle', 45, 2],
      ['Préparer le repas', 20, 1],
    ],
  );
});

test('les frontières suivent le lundi local pour la semaine et le 1er pour le mois', () => {
  const entries = [
    entry('dimanche', 'a', new Date(2026, 7, 23, 23, 59, 0), 10),
    entry('lundi_exact', 'a', new Date(2026, 7, 24, 0, 0, 0), 10),
    entry('juillet', 'a', new Date(2026, 6, 31, 23, 59, 0), 10),
    entry('aout_exact', 'a', new Date(2026, 7, 1, 0, 0, 0), 10),
  ];

  const week = filterHistoryEntries(entries, 'week', null, NOW);
  assert.deepEqual(week.map((item) => item.id), ['lundi_exact']);

  const month = filterHistoryEntries(entries, 'month', null, NOW);
  // Le mois d’août couvre tout août : le dimanche 23 au soir y reste inclus,
  // seule la saisie de juillet sort.
  assert.deepEqual(month.map((item) => item.id), ['dimanche', 'lundi_exact', 'aout_exact']);

  const all = filterHistoryEntries(entries, 'all', null, NOW);
  assert.equal(all.length, 4);
});

test('le changement d’année et la borne haute « maintenant » restent exacts', () => {
  // NOW début janvier : le mois couvre janvier uniquement, jamais décembre.
  const JANUARY_NOW = new Date(2027, 0, 1, 12, 0, 0);
  const entries = [
    entry('reveillon', 'a', new Date(2026, 11, 31, 23, 59, 0), 10),
    entry('nouvel_an_exact', 'a', new Date(2027, 0, 1, 0, 0, 0), 10),
    // Borne haute : une saisie exactement à now est comptée une seule fois,
    // une saisie une seconde après now sort déjà.
    entry('exactement_now', 'a', JANUARY_NOW, 10),
    entry('apres_now', 'a', new Date(JANUARY_NOW.getTime() + 1000), 10),
  ];

  const month = filterHistoryEntries(entries, 'month', null, JANUARY_NOW);
  assert.deepEqual(month.map((item) => item.id), ['nouvel_an_exact', 'exactement_now']);

  const week = filterHistoryEntries(entries, 'week', null, JANUARY_NOW);
  // Vendredi 1er janvier 2027 : la semaine locale démarre ce lundi 28 décembre,
  // la veille du réveillon y reste donc incluse.
  assert.deepEqual(week.map((item) => item.id), [
    'reveillon',
    'nouvel_an_exact',
    'exactement_now',
  ]);
});

// DRC-05 (MOB-C4-F2) : la borne annoncée à l'écran (« Méthode : … (Semaine/
// Mois du …, de 00:00 à maintenant) ») doit rester exactement la borne
// appliquée au filtrage, y compris au passage d'année et à la borne haute
// `now`. Oracle indépendant : la date attendue est reconstruite depuis
// getPeriodStart (la même fonction que le filtrage), pas copiée en dur.
const MOIS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

function expectedBoundsLabel(period: 'week' | 'month', start: Date): string {
  const label = period === 'week' ? 'Semaine' : 'Mois';
  const day = start.getDate();
  const dayLabel = day === 1 ? '1er' : String(day);
  const month = MOIS_FR[start.getMonth()] ?? '';
  return `${label} du ${dayLabel} ${month} ${start.getFullYear()}, de 00:00 à maintenant (horloge de l’appareil)`;
}

test('passage d’année et borne haute now : bornes annoncées identiques aux bornes filtrées', () => {
  // Vendredi 1er janvier 2027 12:00 : le mois démarre exactement à now-12h
  // (1er janvier 00:00) et la semaine chevauche encore décembre 2026.
  const YEAR_NOW = new Date(2027, 0, 1, 12, 0, 0);

  for (const period of ['week', 'month'] as const) {
    const start = getPeriodStart(period, YEAR_NOW);

    // 1. Le libellé affiché nomme précisément le début calculé.
    assert.equal(describePeriodBounds(period, YEAR_NOW), expectedBoundsLabel(period, start));

    // 2. Le filtrage applique exactement l'intervalle annoncé [début ; now] :
    //    une saisie exactement au début passe, une seconde avant sort ;
    //    une saisie exactement à now passe, une seconde après sort.
    const atStart = entry('borne_debut', 'a', start, 10);
    const beforeStart = entry('avant_borne', 'a', new Date(start.getTime() - 1000), 10);
    const atNow = entry('borne_now', 'a', YEAR_NOW, 10);
    const afterNow = entry('apres_now', 'a', new Date(YEAR_NOW.getTime() + 1000), 10);
    const kept = filterHistoryEntries([atStart, beforeStart, atNow, afterNow], period, null, YEAR_NOW);
    assert.deepEqual(kept.map((item) => item.id), ['borne_debut', 'borne_now']);
  }

  // La semaine annoncée au 1er janvier 2027 couvre bien la fin décembre :
  // le libellé doit porter l'année précédente, sans décalage de semaine ISO.
  assert.match(
    describePeriodBounds('week', YEAR_NOW) ?? '',
    /Semaine du 28 décembre 2026, de 00:00 à maintenant/,
  );
});

test('le filtre par membre ne garde que ses entrées, « null » garde tout le foyer', () => {
  const entries = [
    entry('noa_1', 'user_noa', new Date(2026, 7, 25, 9, 0, 0), 10),
    entry('camille_1', 'user_camille', new Date(2026, 7, 25, 10, 0, 0), 20),
    entry('sam_1', 'user_sam', new Date(2026, 7, 24, 8, 0, 0), 30),
  ];
  const noaOnly = filterHistoryEntries(entries, 'all', 'user_noa', NOW);
  assert.deepEqual(noaOnly.map((item) => item.id), ['noa_1']);

  const wholeHousehold = filterHistoryEntries(entries, 'all', null, NOW);
  assert.equal(wholeHousehold.length, 3);
});

test('aucune correspondance produit une synthèse vide prête pour un état calme', () => {
  // Entrées de juillet uniquement : hors semaine et hors mois d’août.
  const entries = [
    entry('juil_1', 'a', new Date(2026, 6, 15, 9, 0, 0), 10),
    entry('juil_2', 'b', new Date(2026, 6, 20, 9, 0, 0), 25),
  ];
  for (const period of ['week', 'month'] as const) {
    const filtered = filterHistoryEntries(entries, period, null, NOW);
    assert.equal(filtered.length, 0);
    const synthesis = buildHistorySynthesis(filtered, TASKS, true);
    assert.deepEqual(synthesis, {
      totalMinutes: 0,
      totalValue: 0,
      entryCount: 0,
      byTask: [],
    });
  }
});

test('en gratuit la valeur reste le temps brut, quel que soit le poids figé', () => {
  const entries = [entry('pese', 'a', new Date(2026, 7, 25, 9, 0, 0), 10, 10)];
  const synthesis = buildHistorySynthesis(entries, TASKS, false);
  // Poids effectif 1 : 10 minutes restent 10, jamais 100.
  assert.equal(synthesis.totalValue, 10);
  assert.equal(synthesis.totalMinutes, 10);
  assert.equal(synthesis.byTask[0]?.value, 10);
});

test('la répartition est déterministe à égalité de minutes et nomme les tâches archivées', () => {
  const entries = [
    entry('v', 'a', new Date(2026, 7, 25, 9, 0, 0), 20, 1, 'task_dishes'),
    entry('c', 'a', new Date(2026, 7, 25, 10, 0, 0), 20, 1, 'task_cooking'),
    entry('x', 'a', new Date(2026, 7, 25, 11, 0, 0), 5, 1, 'task_disparue'),
  ];
  const first = buildHistorySynthesis(entries, TASKS, false);
  const second = buildHistorySynthesis([...entries].reverse(), TASKS, false);
  assert.deepEqual(first, second);
  // Égalité de minutes : collation « fr » croissante sur le libellé.
  assert.deepEqual(
    first.byTask.map((row) => row.label),
    ['Préparer le repas', 'Vaisselle', 'Tâche archivée'],
  );
  assert.equal(first.byTask[2]?.taskId, 'task_disparue');
});

test('composition écran : fenêtre de 30 jours puis filtres puis synthèse restent cohérentes', () => {
  const snapshot = createDemoSnapshot(NOW);
  const visible = getVisibleHistory(
    snapshot.entries,
    snapshot.household.id,
    30, // repli gratuit
    NOW,
  );
  // 19 saisies de semis, celle à J-32 sort de la fenêtre de 30 jours.
  assert.equal(visible.length, 18);

  const weekSelection = filterHistoryEntries(visible, 'week', null, NOW);
  // Le semis place les jours J-0 à J-2 dans la semaine du lundi 24 août ;
  // J-3 tombe le dimanche 23 août, exclu.
  assert.equal(weekSelection.length, 6);

  const synthesis = buildHistorySynthesis(weekSelection, snapshot.tasks, true);
  assert.equal(synthesis.entryCount, weekSelection.length);
  // Invariant d’affichage : la répartition recompose exactement le total.
  const breakdownMinutes = synthesis.byTask.reduce((sum, row) => sum + row.minutes, 0);
  assert.ok(Math.abs(breakdownMinutes - synthesis.totalMinutes) < Number.EPSILON);
  // Toutes les entrées retenues sont bien postérieures au lundi 00:00 local.
  const weekStart = new Date(2026, 7, 24, 0, 0, 0);
  for (const item of weekSelection) {
    assert.ok(item.completedAt !== null && new Date(item.completedAt) >= weekStart);
  }

  // Un filtre membre plus restrictif ne peut qu’amoindrir la sélection semaine.
  const noaWeek = filterHistoryEntries(visible, 'week', 'user_noa', NOW);
  assert.ok(noaWeek.length > 0);
  assert.ok(noaWeek.length <= weekSelection.length);
  for (const item of noaWeek) {
    assert.equal(item.userId, 'user_noa');
  }
});
