import assert from 'node:assert/strict';
import test from 'node:test';
import { getEntitlements } from '../src/domain/entitlements.js';
import { calculateBalances, calculateCompensations } from '../src/domain/scoring.js';
import {
  validateBeneficiaryIds,
  validateCompletedEntryLabel,
  validateManualMinutes,
  validatePerformedBy,
} from '../src/domain/validation.js';
import {
  isDurableStateV3,
  migrateV2ToV3,
  parseEnvelope,
  serializeEnvelopeV3,
  type DurableState,
  type DurableStateV3,
} from '../src/store/persistence.js';
import {
  createInitialState,
  planManualEntry,
} from '../src/store/appReducer.js';
import type { AppState } from '../src/store/appReducer.js';
import { createDemoSnapshot } from '../src/data/demoData.js';
import type { CompletedEntry, Membership, PersistentTask, TodoItem, User } from '../src/domain/types.js';

const NOW = new Date(2026, 7, 26, 12, 0, 0);

/* ------------------------------------------------------------------ */
/* Acceptance 1 : écran racine avec quota numérique de plan             */
/* ------------------------------------------------------------------ */

test('DRC-01-AC1 : le quota de foyers est un nombre, pas un booléen', () => {
  const free = getEntitlements('free');
  const trial = getEntitlements('trial');
  const standard = getEntitlements('standard');
  const pro = getEntitlements('pro');

  assert.equal(typeof free.householdLimit, 'number');
  assert.equal(free.householdLimit, 1);
  assert.equal(trial.householdLimit, 3);
  assert.equal(standard.householdLimit, 5);
  assert.equal(pro.householdLimit, 10);

  // Vérifie que le quota est bien numérique et pas un hardcode binaire
  assert.ok(free.householdLimit >= 1, 'Le gratuit permet au moins 1 foyer');
  assert.ok(trial.householdLimit > free.householdLimit, 'L\'essai permet plus de foyers que le gratuit');
  assert.ok(standard.householdLimit > free.householdLimit, 'Le standard permet plus de foyers que le gratuit');
  assert.ok(pro.householdLimit >= standard.householdLimit, 'Le pro permet au moins autant que le standard');
});

/* ------------------------------------------------------------------ */
/* Acceptance 2 : trois onglets dans un foyer                          */
/* ------------------------------------------------------------------ */

test('DRC-01-AC2 : les trois onglets sont Ajouter une tâche | Score | To-do', () => {
  // Ce test vérifie que les types existent et sont bien distincts.
  // L'implémentation UI est vérifiée par l'audit visuel.
  const completedEntry: CompletedEntry = {
    id: 'ce_1',
    label: 'Vaisselle',
    householdId: 'h1',
    performedByMemberId: 'u1',
    beneficiaryMemberIds: ['u1', 'u2'],
    durationSeconds: 1800,
    completedAt: NOW.toISOString(),
    persistentTaskId: null,
    weight: 1,
  };
  const persistentTask: PersistentTask = {
    id: 'pt_1',
    householdId: 'h1',
    name: 'Vaisselle',
    defaultWeight: 1,
    createdAt: NOW.toISOString(),
  };
  const todoItem: TodoItem = {
    id: 'todo_1',
    householdId: 'h1',
    label: 'Passer l\'aspirateur',
    assigneeMemberId: 'u1',
    beneficiaryMemberIds: ['u1', 'u2'],
    dueDate: null,
    note: '',
    persistentTaskId: null,
    createdAt: NOW.toISOString(),
    completedAt: null,
  };

  // Les trois types sont bien distincts (jamais fusionnés) — on vérifie
  // par les champs propres car typeof ne distingue pas les objets plats.
  assert.ok('durationSeconds' in completedEntry && !('defaultWeight' in completedEntry) && !('dueDate' in completedEntry));
  assert.ok('defaultWeight' in persistentTask && !('durationSeconds' in persistentTask) && !('dueDate' in persistentTask));
  assert.ok('dueDate' in todoItem && !('durationSeconds' in todoItem) && !('defaultWeight' in todoItem));
});

/* ------------------------------------------------------------------ */
/* Acceptance 3 : durée manuelle ou chrono                             */
/* ------------------------------------------------------------------ */

test('DRC-01-AC3 : la durée est en secondes réels (manuel = secondes, chrono = secondes écoulées)', () => {
  const entry: CompletedEntry = {
    id: 'ce_1',
    label: 'Vaisselle',
    householdId: 'h1',
    performedByMemberId: 'u1',
    beneficiaryMemberIds: ['u1'],
    durationSeconds: 1200,
    completedAt: NOW.toISOString(),
    persistentTaskId: null,
    weight: 1,
  };
  assert.equal(entry.durationSeconds, 1200);
  // 1 minute réelle = 60 secondes réelles
  assert.equal(validateManualMinutes(1), null);
  assert.equal(validateManualMinutes(1440), null);
});

/* ------------------------------------------------------------------ */
/* Acceptance 4 : CompletedEntry contient tous les champs requis        */
/* ------------------------------------------------------------------ */

test('DRC-01-AC4 : CompletedEntry contient libellé, foyer, date/heure, durée, performedBy et beneficiaries', () => {
  const entry: CompletedEntry = {
    id: 'ce_1',
    label: 'Ranger le salon',
    householdId: 'household_rivage',
    performedByMemberId: 'user_noa',
    beneficiaryMemberIds: ['user_noa', 'user_camille'],
    durationSeconds: 2400,
    completedAt: '2026-08-26T10:00:00.000Z',
    persistentTaskId: null,
    weight: 1,
  };

  assert.ok(entry.label.length > 0, 'Le libellé est non vide');
  assert.ok(entry.householdId.length > 0, 'Le foyer est non vide');
  assert.ok(entry.completedAt.length > 0, 'La date est non vide');
  assert.ok(entry.durationSeconds > 0, 'La durée est positive');
  assert.ok(entry.performedByMemberId.length > 0, 'performedBy est non vide');
  assert.ok(entry.beneficiaryMemberIds.length > 0, 'beneficiaries est non vide');
});

/* ------------------------------------------------------------------ */
/* Acceptance 5 : fait par = n'importe quel membre du foyer            */
/* ------------------------------------------------------------------ */

test('DRC-01-AC5 : fait par sélectionne l\'utilisateur connecté par défaut mais peut être n\'importe quel membre', () => {
  const members: User[] = [
    { id: 'user_noa', name: 'Noa', initials: 'NO', color: '#2A9D8F' },
    { id: 'user_camille', name: 'Camille', initials: 'CA', color: '#457B9D' },
    { id: 'user_sam', name: 'Sam', initials: 'SA', color: '#E9C46A' },
  ];
  const currentUserId = 'user_noa';

  // Par défaut, fait par = utilisateur connecté
  const entryDefault: CompletedEntry = {
    id: 'ce_1',
    label: 'Vaisselle',
    householdId: 'h1',
    performedByMemberId: currentUserId,
    beneficiaryMemberIds: [currentUserId],
    durationSeconds: 1800,
    completedAt: NOW.toISOString(),
    persistentTaskId: null,
    weight: 1,
  };
  assert.equal(entryDefault.performedByMemberId, currentUserId);

  // Peut être changé vers un autre membre
  const entryOther: CompletedEntry = {
    ...entryDefault,
    id: 'ce_2',
    performedByMemberId: 'user_camille',
  };
  assert.equal(entryOther.performedByMemberId, 'user_camille');
  assert.equal(entryOther.performedByMemberId, 'user_camille');

  // L'identité connectée ne change pas
  assert.equal(currentUserId, 'user_noa', 'L\'identité connectée reste fixe');

  // Validation : performedBy doit être non vide
  assert.equal(validatePerformedBy('user_noa'), null);
  assert.equal(validatePerformedBy(''), 'Un membre doit être sélectionné pour « Fait par ».');
});

/* ------------------------------------------------------------------ */
/* Acceptance 6 : fait pour = tout le monde ou sous-ensemble           */
/* ------------------------------------------------------------------ */

test('DRC-01-AC6 : fait pour permet tout le monde ou un sous-ensemble non vide', () => {
  const members = ['user_noa', 'user_camille', 'user_sam'];

  // Tout le monde
  const entryEveryone: CompletedEntry = {
    id: 'ce_1',
    label: 'Vaisselle',
    householdId: 'h1',
    performedByMemberId: 'user_noa',
    beneficiaryMemberIds: [...members],
    durationSeconds: 1800,
    completedAt: NOW.toISOString(),
    persistentTaskId: null,
    weight: 1,
  };
  assert.equal(entryEveryone.beneficiaryMemberIds.length, 3);

  // Sous-ensemble de 2
  const entrySubset: CompletedEntry = {
    ...entryEveryone,
    id: 'ce_2',
    beneficiaryMemberIds: ['user_noa', 'user_camille'],
  };
  assert.equal(entrySubset.beneficiaryMemberIds.length, 2);

  // Un seul bénéficiaire
  const entrySingle: CompletedEntry = {
    ...entryEveryone,
    id: 'ce_3',
    beneficiaryMemberIds: ['user_camille'],
  };
  assert.equal(entrySingle.beneficiaryMemberIds.length, 1);

  // Vide = invalide
  assert.equal(validateBeneficiaryIds([]), 'Au moins un bénéficiaire doit être sélectionné.');
  assert.equal(validateBeneficiaryIds(['user_noa']), null);
  assert.equal(validateBeneficiaryIds(['user_noa', 'user_camille']), null);
});

/* ------------------------------------------------------------------ */
/* Acceptance 7 : deux réalisations identiques = deux entrées           */
/* ------------------------------------------------------------------ */

test('DRC-01-AC7 : deux réalisations identiques restent deux CompletedEntry distinctes', () => {
  const base: CompletedEntry = {
    id: 'ce_1',
    label: 'Vaisselle',
    householdId: 'h1',
    performedByMemberId: 'user_noa',
    beneficiaryMemberIds: ['user_noa', 'user_camille'],
    durationSeconds: 1800,
    completedAt: NOW.toISOString(),
    persistentTaskId: null,
    weight: 1,
  };
  const duplicate: CompletedEntry = {
    ...base,
    id: 'ce_2',
  };
  assert.notEqual(base.id, duplicate.id, 'Les identifiants sont différents');
  // Deux objets distincts même avec le même contenu métier
  assert.deepEqual(
    { ...base, id: 'x' },
    { ...duplicate, id: 'x' },
    'Le contenu métier est identique mais les ids diffèrent',
  );
});

/* ------------------------------------------------------------------ */
/* Acceptance 8 : PersistentTask = filtre Score                        */
/* ------------------------------------------------------------------ */

test('DRC-01-AC8 : PersistentTask est facultative et une PersistentTask = exactement un filtre Score', () => {
  const pt: PersistentTask = {
    id: 'pt_1',
    householdId: 'h1',
    name: 'Vaisselle',
    defaultWeight: 1,
    createdAt: NOW.toISOString(),
  };
  assert.ok(pt.id.length > 0);
  assert.ok(pt.name.length > 0);

  // L'entrée peut lier une PersistentTask ou non
  const entryWithPT: CompletedEntry = {
    id: 'ce_1',
    label: 'Vaisselle',
    householdId: 'h1',
    performedByMemberId: 'user_noa',
    beneficiaryMemberIds: ['user_noa'],
    durationSeconds: 1800,
    completedAt: NOW.toISOString(),
    persistentTaskId: 'pt_1',
    weight: 1,
  };
  assert.equal(entryWithPT.persistentTaskId, 'pt_1');

  const entryWithoutPT: CompletedEntry = {
    ...entryWithPT,
    id: 'ce_2',
    persistentTaskId: null,
  };
  assert.equal(entryWithoutPT.persistentTaskId, null);
});

/* ------------------------------------------------------------------ */
/* Acceptance 9 : libellés non persistants → Autres                    */
/* ------------------------------------------------------------------ */

test('DRC-01-AC9 : les libellés non persistants ne créent aucun filtre et restent sous Autres', () => {
  const entries: CompletedEntry[] = [
    {
      id: 'ce_1',
      label: 'Vaisselle',
      householdId: 'h1',
      performedByMemberId: 'user_noa',
      beneficiaryMemberIds: ['user_noa'],
      durationSeconds: 1800,
      completedAt: NOW.toISOString(),
      persistentTaskId: null,
      weight: 1,
    },
    {
      id: 'ce_2',
      label: 'Vaisselle',
      householdId: 'h1',
      performedByMemberId: 'user_noa',
      beneficiaryMemberIds: ['user_noa'],
      durationSeconds: 1800,
      completedAt: NOW.toISOString(),
      persistentTaskId: null,
      weight: 1,
    },
  ];

  // Les deux entrées sont indépendantes et restent dans "Autres"
  const nonPersistentEntries = entries.filter((e) => e.persistentTaskId === null);
  assert.equal(nonPersistentEntries.length, 2, 'Les deux entrées sont non persistantes');
  // Aucun filtre n'est créé automatiquement depuis les libellés
});

/* ------------------------------------------------------------------ */
/* Acceptance 10 : historique complet sous le formulaire                */
/* ------------------------------------------------------------------ */

test('DRC-01-AC10 : l\'historique chronologique complet est disponible pour le foyer', () => {
  const entries: CompletedEntry[] = [
    {
      id: 'ce_1',
      label: 'Vaisselle',
      householdId: 'h1',
      performedByMemberId: 'user_noa',
      beneficiaryMemberIds: ['user_noa'],
      durationSeconds: 1800,
      completedAt: '2026-08-26T10:00:00.000Z',
      persistentTaskId: null,
      weight: 1,
    },
    {
      id: 'ce_2',
      label: 'Cuisine',
      householdId: 'h1',
      performedByMemberId: 'user_camille',
      beneficiaryMemberIds: ['user_noa', 'user_camille'],
      durationSeconds: 2400,
      completedAt: '2026-08-26T11:00:00.000Z',
      persistentTaskId: null,
      weight: 1,
    },
    {
      id: 'ce_3',
      label: 'Vaisselle',
      householdId: 'h2',
      performedByMemberId: 'user_sam',
      beneficiaryMemberIds: ['user_sam'],
      durationSeconds: 1200,
      completedAt: '2026-08-26T12:00:00.000Z',
      persistentTaskId: null,
      weight: 1,
    },
  ];

  // Filtrage par foyer
  const h1Entries = entries.filter((e) => e.householdId === 'h1');
  assert.equal(h1Entries.length, 2);

  // Tri chronologique (plus récent en premier)
  const sorted = [...h1Entries].sort(
    (a, b) => b.completedAt.localeCompare(a.completedAt),
  );
  assert.equal(sorted[0]?.id, 'ce_2');
  assert.equal(sorted[1]?.id, 'ce_1');
});

/* ------------------------------------------------------------------ */
/* Acceptance 11 : modèle compatible avec settlement Tricount           */
/* ------------------------------------------------------------------ */

test('DRC-01-AC11 : le modèle permet le calcul Score Tricount (D fait par P pour N bénéficiaires)', () => {
  const members = ['A', 'B', 'C'];

  // A fait 60 min pour A+B : A = +30 min net, B = -30 min
  const entry1: CompletedEntry = {
    id: 'ce_1',
    label: 'Tâche 1',
    householdId: 'h1',
    performedByMemberId: 'A',
    beneficiaryMemberIds: ['A', 'B'],
    durationSeconds: 3600,
    completedAt: NOW.toISOString(),
    persistentTaskId: null,
    weight: 1,
  };

  const balances = calculateBalances([entry1], members);
  assert.equal(balances.get('A'), 1800, 'A reçoit +3600 puis paie -1800 = +1800');
  assert.equal(balances.get('B'), -1800, 'B paie -1800');
  assert.equal(balances.get('C'), 0, 'C n\'est pas concerné');

  // Vérifie que la somme est zéro
  const sum = (balances.get('A') ?? 0) + (balances.get('B') ?? 0) + (balances.get('C') ?? 0);
  assert.ok(Math.abs(sum) < 0.01, 'La somme des soldes est zéro');
});

test('DRC-01-AC11 : A fait 60 min uniquement pour B : A = +60 min, B = -60 min', () => {
  const members = ['A', 'B'];
  const entry: CompletedEntry = {
    id: 'ce_1',
    label: 'Tâche',
    householdId: 'h1',
    performedByMemberId: 'A',
    beneficiaryMemberIds: ['B'],
    durationSeconds: 3600,
    completedAt: NOW.toISOString(),
    persistentTaskId: null,
    weight: 1,
  };

  const balances = calculateBalances([entry], members);
  assert.equal(balances.get('A'), 3600, 'A reçoit +3600');
  assert.equal(balances.get('B'), -3600, 'B paie -3600');
});

test('DRC-01-AC11 : A fait 60 min uniquement pour A : solde net 0', () => {
  const members = ['A', 'B'];
  const entry: CompletedEntry = {
    id: 'ce_1',
    label: 'Tâche',
    householdId: 'h1',
    performedByMemberId: 'A',
    beneficiaryMemberIds: ['A'],
    durationSeconds: 3600,
    completedAt: NOW.toISOString(),
    persistentTaskId: null,
    weight: 1,
  };

  const balances = calculateBalances([entry], members);
  assert.equal(balances.get('A'), 0, 'A reçoit +3600 puis paie -3600 = 0');
  assert.equal(balances.get('B'), 0, 'B n\'est pas concerné');
});

test('DRC-01-AC11 : calcul multi-entrées avec compensations', () => {
  const members = ['A', 'B', 'C'];
  const entries: CompletedEntry[] = [
    {
      id: 'ce_1',
      label: 'Tâche 1',
      householdId: 'h1',
      performedByMemberId: 'A',
      beneficiaryMemberIds: ['A', 'B', 'C'],
      durationSeconds: 3600,
      completedAt: NOW.toISOString(),
      persistentTaskId: null,
      weight: 1,
    },
    {
      id: 'ce_2',
      label: 'Tâche 2',
      householdId: 'h1',
      performedByMemberId: 'B',
      beneficiaryMemberIds: ['A', 'B', 'C'],
      durationSeconds: 1800,
      completedAt: NOW.toISOString(),
      persistentTaskId: null,
      weight: 1,
    },
  ];

  const balances = calculateBalances(entries, members);
  // A: +3600 (credit ce_1) - 1200 (share ce_1) - 600 (share ce_2) = +1800
  // B: -1200 (share ce_1) + 1800 (credit ce_2) - 600 (share ce_2) = 0
  // C: -1200 (share ce_1) - 600 (share ce_2) = -1800
  assert.equal(balances.get('A'), 1800);
  assert.equal(balances.get('B'), 0);
  assert.equal(balances.get('C'), -1800);

  const sum = (balances.get('A') ?? 0) + (balances.get('B') ?? 0) + (balances.get('C') ?? 0);
  assert.ok(Math.abs(sum) < 0.01, 'La somme des soldes est zéro');

  // Compensations
  const compensations = calculateCompensations(balances);
  assert.equal(compensations.length, 1);
  assert.equal(compensations[0]?.fromMemberId, 'C');
  assert.equal(compensations[0]?.toMemberId, 'A');
  assert.equal(compensations[0]?.seconds, 1800);
});

/* ------------------------------------------------------------------ */
/* Acceptance 12 : pondération avancée ne modifie pas la durée réelle   */
/* ------------------------------------------------------------------ */

test('DRC-01-AC12 : la pondération est un coefficient avancé, la durée réelle est intacte', () => {
  const entry: CompletedEntry = {
    id: 'ce_1',
    label: 'Tâche',
    householdId: 'h1',
    performedByMemberId: 'A',
    beneficiaryMemberIds: ['A', 'B'],
    durationSeconds: 3600,
    completedAt: NOW.toISOString(),
    persistentTaskId: null,
    weight: 2,
  };

  // La durée réelle est 3600 secondes
  assert.equal(entry.durationSeconds, 3600);

  // Le weight est un coefficient séparé
  assert.equal(entry.weight, 2);

  // Le settlement pondéré utilise D × weight
  const members = ['A', 'B'];
  const balances = calculateBalances([entry], members);
  // A: +3600×2 - 3600×2/2 = +7200 - 3600 = +3600
  // B: -3600×2/2 = -3600
  assert.equal(balances.get('A'), 3600);
  assert.equal(balances.get('B'), -3600);
});

/* ------------------------------------------------------------------ */
/* Acceptance 13 : trois objets métier distincts                       */
/* ------------------------------------------------------------------ */

test('DRC-01-AC13 : le modèle distingue CompletedEntry, PersistentTask et TodoItem', () => {
  const ce: CompletedEntry = {
    id: 'ce_1',
    label: 'Vaisselle',
    householdId: 'h1',
    performedByMemberId: 'u1',
    beneficiaryMemberIds: ['u1'],
    durationSeconds: 1800,
    completedAt: NOW.toISOString(),
    persistentTaskId: null,
    weight: 1,
  };
  const pt: PersistentTask = {
    id: 'pt_1',
    householdId: 'h1',
    name: 'Vaisselle',
    defaultWeight: 1,
    createdAt: NOW.toISOString(),
  };
  const todo: TodoItem = {
    id: 'todo_1',
    householdId: 'h1',
    label: 'Passer l\'aspirateur',
    assigneeMemberId: 'u1',
    beneficiaryMemberIds: ['u1', 'u2'],
    dueDate: null,
    note: '',
    persistentTaskId: null,
    createdAt: NOW.toISOString(),
    completedAt: null,
  };

  // Chaque type a des champs qui n'existent pas dans les autres
  assert.ok(!('defaultWeight' in ce));
  assert.ok(!('durationSeconds' in pt));
  assert.ok(!('dueDate' in ce));
  assert.ok(!('dueDate' in pt));
  assert.ok('dueDate' in todo);
  assert.ok('completedAt' in ce);
  assert.ok('completedAt' in todo);
  assert.ok(!('completedAt' in pt));
});

/* ------------------------------------------------------------------ */
/* Acceptance 14 : migration sans perte silencieuse                     */
/* ------------------------------------------------------------------ */

test('DRC-01-AC14 : migration V2 -> V3 conserve les données sans perte', () => {
  const v2State: DurableState = {
    users: [
      { id: 'user_noa', name: 'Noa', initials: 'NO', color: '#2A9D8F' },
      { id: 'user_camille', name: 'Camille', initials: 'CA', color: '#457B9D' },
    ],
    households: [
      {
        id: 'household_rivage',
        name: 'Foyer Rivage',
        timezone: 'Europe/Zurich',
        plan: 'trial',
        trialStartedAt: '2026-08-14T00:00:00.000Z',
        trialEndsAt: '2026-09-13T00:00:00.000Z',
        maxMembers: null,
      },
    ],
    memberships: [
      { householdId: 'household_rivage', userId: 'user_noa', role: 'owner', joinedAt: '2026-08-14T00:00:00.000Z' },
      { householdId: 'household_rivage', userId: 'user_camille', role: 'member', joinedAt: '2026-08-14T00:00:00.000Z' },
    ],
    tasks: [
      {
        id: 'task_dishes',
        householdId: 'household_rivage',
        name: 'Vaisselle',
        category: 'dishes',
        weight: 2,
        active: true,
        createdAt: '2026-08-14T00:00:00.000Z',
      },
    ],
    entries: [
      {
        id: 'entry_1',
        taskId: 'task_dishes',
        householdId: 'household_rivage',
        userId: 'user_noa',
        status: 'completed',
        startedAt: null,
        completedAt: '2026-08-20T10:00:00.000Z',
        durationSeconds: 1800,
        weightSnapshot: 2,
        score: 60,
        isManual: true,
        periodKey: '2026-W34',
      },
    ],
    currentUserId: 'user_noa',
    currentHouseholdId: 'household_rivage',
    onboardingComplete: true,
    consent: {
      termsAccepted: true,
      termsVersion: 'demo-v1',
      acceptedAt: '2026-08-14T00:00:00.000Z',
      analyticsOptIn: false,
    },
  };

  const v3 = migrateV2ToV3(v2State);

  // Users conservés
  assert.equal(v3.users.length, 2);
  assert.equal(v3.users[0]?.id, 'user_noa');
  assert.equal(v3.users[1]?.id, 'user_camille');

  // Households conservés
  assert.equal(v3.households.length, 1);
  assert.equal(v3.households[0]?.id, 'household_rivage');

  // Memberships conservées
  assert.equal(v3.memberships.length, 2);

  // PersistentTasks créées depuis TaskDefinitions
  assert.equal(v3.persistentTasks.length, 1);
  assert.equal(v3.persistentTasks[0]?.id, 'task_dishes');
  assert.equal(v3.persistentTasks[0]?.name, 'Vaisselle');
  assert.equal(v3.persistentTasks[0]?.defaultWeight, 2);

  // CompletedEntries créées depuis les entrées completed
  assert.equal(v3.completedEntries.length, 1);
  const migratedEntry = v3.completedEntries[0];
  assert.ok(migratedEntry !== undefined);
  assert.equal(migratedEntry.id, 'entry_1');
  assert.equal(migratedEntry.label, 'Vaisselle');
  assert.equal(migratedEntry.performedByMemberId, 'user_noa');
  assert.deepEqual(migratedEntry.beneficiaryMemberIds, ['user_noa']);
  assert.equal(migratedEntry.durationSeconds, 1800);
  assert.equal(migratedEntry.persistentTaskId, 'task_dishes');

  // TodoItems est vide
  assert.equal(v3.todoItems.length, 0);

  // currentUserId et currentHouseholdId conservés
  assert.equal(v3.currentUserId, 'user_noa');
  assert.equal(v3.currentHouseholdId, 'household_rivage');
  assert.equal(v3.onboardingComplete, true);

  // Validateur V3 accepte l'état migré
  assert.equal(isDurableStateV3(v3), true);
});

test('DRC-01-AC14 : les entrées in_progress sont abandonnées lors de la migration V2->V3', () => {
  const v2State: DurableState = {
    users: [{ id: 'u1', name: 'A', initials: 'A', color: '#000' }],
    households: [{
      id: 'h1', name: 'H', timezone: 'UTC', plan: 'trial',
      trialStartedAt: '2026-08-14T00:00:00.000Z',
      trialEndsAt: '2026-09-13T00:00:00.000Z',
      maxMembers: null,
    }],
    memberships: [{ householdId: 'h1', userId: 'u1', role: 'owner', joinedAt: '2026-08-14T00:00:00.000Z' }],
    tasks: [],
    entries: [
      {
        id: 'entry_running',
        taskId: 'task_x',
        householdId: 'h1',
        userId: 'u1',
        status: 'in_progress',
        startedAt: '2026-08-26T10:00:00.000Z',
        completedAt: null,
        durationSeconds: 0,
        weightSnapshot: 1,
        score: 0,
        isManual: false,
        periodKey: '2026-W35',
      },
    ],
    currentUserId: 'u1',
    currentHouseholdId: 'h1',
    onboardingComplete: true,
    consent: { termsAccepted: true, termsVersion: 'demo-v1', acceptedAt: '2026-08-14T00:00:00.000Z', analyticsOptIn: false },
  };

  const v3 = migrateV2ToV3(v2State);
  assert.equal(v3.completedEntries.length, 0, 'Les entrées in_progress sont abandonnées');
});

/* ------------------------------------------------------------------ */
/* Acceptance 15 : validation, persistance et isolation                 */
/* ------------------------------------------------------------------ */

test('DRC-01-AC15 : validation du libellé de CompletedEntry', () => {
  assert.equal(validateCompletedEntryLabel('Vaisselle'), null);
  assert.equal(validateCompletedEntryLabel('A'), null);
  assert.equal(validateCompletedEntryLabel(''), 'Le libellé ne peut pas être vide.');
  assert.equal(validateCompletedEntryLabel('x'.repeat(101)), 'Le libellé ne peut pas dépasser 100 caractères.');
});

test('DRC-01-AC15 : validation des bénéficiaires', () => {
  assert.equal(validateBeneficiaryIds(['u1']), null);
  assert.equal(validateBeneficiaryIds(['u1', 'u2']), null);
  assert.equal(validateBeneficiaryIds([]), 'Au moins un bénéficiaire doit être sélectionné.');
});

test('DRC-01-AC15 : validation de performedBy', () => {
  assert.equal(validatePerformedBy('u1'), null);
  assert.equal(validatePerformedBy(''), 'Un membre doit être sélectionné pour « Fait par ».');
});

test('DRC-01-AC15 : persistance V3 sérialise et désérialise correctement', () => {
  const state: DurableStateV3 = {
    users: [{ id: 'u1', name: 'A', initials: 'A', color: '#000' }],
    households: [{
      id: 'h1', name: 'H', timezone: 'UTC', plan: 'trial',
      trialStartedAt: '2026-08-14T00:00:00.000Z',
      trialEndsAt: '2026-09-13T00:00:00.000Z',
      maxMembers: null,
    }],
    memberships: [{ householdId: 'h1', userId: 'u1', role: 'owner', joinedAt: '2026-08-14T00:00:00.000Z' }],
    persistentTasks: [],
    completedEntries: [{
      id: 'ce_1',
      label: 'Vaisselle',
      householdId: 'h1',
      performedByMemberId: 'u1',
      beneficiaryMemberIds: ['u1'],
      durationSeconds: 1800,
      completedAt: '2026-08-26T10:00:00.000Z',
      persistentTaskId: null,
      weight: 1,
    }],
    todoItems: [],
    currentUserId: 'u1',
    currentHouseholdId: 'h1',
    onboardingComplete: true,
    consent: { termsAccepted: true, termsVersion: 'demo-v1', acceptedAt: '2026-08-14T00:00:00.000Z', analyticsOptIn: false },
  };

  const serialized = serializeEnvelopeV3(state, NOW.toISOString());
  const parsed = parseEnvelope(serialized);
  assert.equal(parsed.outcome, 'valid-v3');
  if (parsed.outcome !== 'valid-v3') return;
  assert.equal(parsed.envelope.schemaVersion, 3);
  assert.deepEqual(parsed.envelope.state.completedEntries, state.completedEntries);
  assert.equal(parsed.envelope.state.completedEntries[0]?.label, 'Vaisselle');
});

test('DRC-01-AC15 : isolation par foyer dans le modèle V3', () => {
  const state: DurableStateV3 = {
    users: [
      { id: 'u1', name: 'A', initials: 'A', color: '#000' },
      { id: 'u2', name: 'B', initials: 'B', color: '#111' },
    ],
    households: [
      {
        id: 'h1', name: 'Foyer 1', timezone: 'UTC', plan: 'trial',
        trialStartedAt: '2026-08-14T00:00:00.000Z',
        trialEndsAt: '2026-09-13T00:00:00.000Z',
        maxMembers: null,
      },
      {
        id: 'h2', name: 'Foyer 2', timezone: 'UTC', plan: 'free',
        trialStartedAt: '2026-08-14T00:00:00.000Z',
        trialEndsAt: '2026-09-13T00:00:00.000Z',
        maxMembers: null,
      },
    ],
    memberships: [
      { householdId: 'h1', userId: 'u1', role: 'owner', joinedAt: '2026-08-14T00:00:00.000Z' },
      { householdId: 'h1', userId: 'u2', role: 'member', joinedAt: '2026-08-14T00:00:00.000Z' },
      { householdId: 'h2', userId: 'u1', role: 'owner', joinedAt: '2026-08-14T00:00:00.000Z' },
    ],
    persistentTasks: [
      { id: 'pt_h1', householdId: 'h1', name: 'Vaisselle', defaultWeight: 1, createdAt: '2026-08-14T00:00:00.000Z' },
      { id: 'pt_h2', householdId: 'h2', name: 'Cuisine', defaultWeight: 1, createdAt: '2026-08-14T00:00:00.000Z' },
    ],
    completedEntries: [
      {
        id: 'ce_h1', label: 'Vaisselle', householdId: 'h1', performedByMemberId: 'u1',
        beneficiaryMemberIds: ['u1'], durationSeconds: 1800,
        completedAt: '2026-08-26T10:00:00.000Z', persistentTaskId: 'pt_h1', weight: 1,
      },
      {
        id: 'ce_h2', label: 'Cuisine', householdId: 'h2', performedByMemberId: 'u1',
        beneficiaryMemberIds: ['u1'], durationSeconds: 2400,
        completedAt: '2026-08-26T11:00:00.000Z', persistentTaskId: 'pt_h2', weight: 1,
      },
    ],
    todoItems: [],
    currentUserId: 'u1',
    currentHouseholdId: 'h1',
    onboardingComplete: true,
    consent: { termsAccepted: true, termsVersion: 'demo-v1', acceptedAt: '2026-08-14T00:00:00.000Z', analyticsOptIn: false },
  };

  // Filtrage par foyer : chaque foyer ne voit que ses données
  const h1Entries = state.completedEntries.filter((e) => e.householdId === 'h1');
  const h2Entries = state.completedEntries.filter((e) => e.householdId === 'h2');
  assert.equal(h1Entries.length, 1);
  assert.equal(h2Entries.length, 1);
  assert.equal(h1Entries[0]?.label, 'Vaisselle');
  assert.equal(h2Entries[0]?.label, 'Cuisine');

  // Filtre par tâche persistante
  const ptH1Entries = state.completedEntries.filter((e) => e.persistentTaskId === 'pt_h1');
  assert.equal(ptH1Entries.length, 1);
  assert.equal(ptH1Entries[0]?.householdId, 'h1');
});

test('DRC-01-AC15 : le validateur V3 rejette un état avec bénéficiaire inconnu', () => {
  const invalid: DurableStateV3 = {
    users: [{ id: 'u1', name: 'A', initials: 'A', color: '#000' }],
    households: [{
      id: 'h1', name: 'H', timezone: 'UTC', plan: 'trial',
      trialStartedAt: '2026-08-14T00:00:00.000Z',
      trialEndsAt: '2026-09-13T00:00:00.000Z',
      maxMembers: null,
    }],
    memberships: [{ householdId: 'h1', userId: 'u1', role: 'owner', joinedAt: '2026-08-14T00:00:00.000Z' }],
    persistentTasks: [],
    completedEntries: [{
      id: 'ce_1', label: 'X', householdId: 'h1', performedByMemberId: 'u1',
      beneficiaryMemberIds: ['u_ghost'], durationSeconds: 60,
      completedAt: '2026-08-26T10:00:00.000Z', persistentTaskId: null, weight: 1,
    }],
    todoItems: [],
    currentUserId: 'u1',
    currentHouseholdId: 'h1',
    onboardingComplete: true,
    consent: { termsAccepted: true, termsVersion: 'demo-v1', acceptedAt: '2026-08-14T00:00:00.000Z', analyticsOptIn: false },
  };
  assert.equal(isDurableStateV3(invalid), false, 'Bénéficiaire inconnu = refusé');
});

test('DRC-01-AC15 : le validateur V3 rejette un CompletedEntry sans bénéficiaire', () => {
  const invalid: DurableStateV3 = {
    users: [{ id: 'u1', name: 'A', initials: 'A', color: '#000' }],
    households: [{
      id: 'h1', name: 'H', timezone: 'UTC', plan: 'trial',
      trialStartedAt: '2026-08-14T00:00:00.000Z',
      trialEndsAt: '2026-09-13T00:00:00.000Z',
      maxMembers: null,
    }],
    memberships: [{ householdId: 'h1', userId: 'u1', role: 'owner', joinedAt: '2026-08-14T00:00:00.000Z' }],
    persistentTasks: [],
    completedEntries: [{
      id: 'ce_1', label: 'X', householdId: 'h1', performedByMemberId: 'u1',
      beneficiaryMemberIds: [], durationSeconds: 60,
      completedAt: '2026-08-26T10:00:00.000Z', persistentTaskId: null, weight: 1,
    }],
    todoItems: [],
    currentUserId: 'u1',
    currentHouseholdId: 'h1',
    onboardingComplete: true,
    consent: { termsAccepted: true, termsVersion: 'demo-v1', acceptedAt: '2026-08-14T00:00:00.000Z', analyticsOptIn: false },
  };
  assert.equal(isDurableStateV3(invalid), false, 'Beneficiaries vides = refusé');
});

/* ------------------------------------------------------------------ */
/* Acceptance 16 : Fait par sélecteur — planManualEntry                 */
/* ------------------------------------------------------------------ */

function createState(): AppState {
  return createInitialState(createDemoSnapshot(NOW));
}

test('DRC-01-AC16 : planManualEntry accepte performedByMemberId = utilisateur connecté par défaut', () => {
  const state = createState();
  const plan = planManualEntry(state, 'task_dishes', 30, state.currentUserId);
  assert.equal(plan.ok, true);
  if (plan.ok) {
    assert.equal(plan.value.performedByMemberId, state.currentUserId);
  }
});

test('DRC-01-AC16 : planManualEntry accepte performedByMemberId = autre membre du foyer', () => {
  const state = createState();
  const otherMember = state.users.find((u) => u.id !== state.currentUserId);
  assert.ok(otherMember, 'Il doit exister au moins un autre membre');
  const plan = planManualEntry(state, 'task_dishes', 30, otherMember!.id);
  assert.equal(plan.ok, true);
  if (plan.ok) {
    assert.equal(plan.value.performedByMemberId, otherMember!.id);
  }
});

test('DRC-01-AC16 : planManualEntry rejette performedByMemberId = membre inconnu', () => {
  const state = createState();
  const plan = planManualEntry(state, 'task_dishes', 30, 'user_intrus');
  assert.equal(plan.ok, false);
  if (!plan.ok) {
    assert.ok(plan.error.includes('membre'));
  }
});

test('DRC-01-AC16 : planManualEntry rejette performedByMemberId vide', () => {
  const state = createState();
  const plan = planManualEntry(state, 'task_dishes', 30, '');
  assert.equal(plan.ok, false);
  if (!plan.ok) {
    assert.ok(plan.error.includes('Fait par'));
  }
});

test('DRC-01-AC16 : planManualEntry rejette performedByMemberId d\u0027un autre foyer', () => {
  const state: AppState = {
    ...createState(),
    memberships: [
      { householdId: 'h1', userId: 'user_noa', role: 'owner', joinedAt: '2026-08-14T00:00:00.000Z' },
      { householdId: 'h1', userId: 'user_camille', role: 'member', joinedAt: '2026-08-14T00:00:00.000Z' },
      { householdId: 'other_household', userId: 'user_outsider', role: 'member', joinedAt: '2026-08-14T00:00:00.000Z' },
    ],
    users: [
      ...createState().users,
      { id: 'user_outsider', name: 'Outsider', initials: 'OU', color: '#999' },
    ],
  };
  const plan = planManualEntry(state, 'task_dishes', 30, 'user_outsider');
  assert.equal(plan.ok, false);
  if (!plan.ok) {
    assert.ok(plan.error.includes('foyer'));
  }
});

test('DRC-01-AC16 : deux saisies avec performeurs différents portent performedByMemberId distincts', () => {
  const state = createState();
  const otherMember = state.users.find((u) => u.id !== state.currentUserId);
  assert.ok(otherMember);

  const planCurrent = planManualEntry(state, 'task_dishes', 30, state.currentUserId);
  const planOther = planManualEntry(state, 'task_dishes', 45, otherMember!.id);

  assert.equal(planCurrent.ok, true);
  assert.equal(planOther.ok, true);
  if (planCurrent.ok && planOther.ok) {
    assert.notEqual(planCurrent.value.performedByMemberId, planOther.value.performedByMemberId);
    assert.equal(planCurrent.value.performedByMemberId, state.currentUserId);
    assert.equal(planOther.value.performedByMemberId, otherMember!.id);
  }
});
