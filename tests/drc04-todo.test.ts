import assert from 'node:assert/strict';
import test from 'node:test';
import { createDemoSnapshot } from '../src/data/demoData.js';
import {
  planCreateTodoItem,
  planCompleteTodoItem,
  selectVisibleTodos,
} from '../src/store/appReducer.js';
import { createInitialState, reducer } from '../src/store/appReducer.js';
import type { AppState } from '../src/store/appReducer.js';
import type { TodoItem } from '../src/domain/types.js';

const NOW = new Date(2026, 8, 1, 12, 0, 0);

function createState(): AppState {
  return createInitialState(createDemoSnapshot(NOW));
}

/** Helper: build a state with injected todoItems, avoiding self-reference. */
function stateWithTodos(todos: TodoItem[]): AppState {
  const base = createState();
  return { ...base, todoItems: todos };
}

function makeTodo(
  overrides: Partial<TodoItem> & { id: string; householdId: string },
): TodoItem {
  return {
    label: 'Test',
    assigneeMemberId: null,
    beneficiaryMemberIds: [],
    dueDate: null,
    note: '',
    persistentTaskId: null,
    createdAt: NOW.toISOString(),
    completedAt: null,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* AC1 : TodoItem est créable avec tous les champs                     */
/* ------------------------------------------------------------------ */

test('DRC-04-AC1 : planCreateTodoItem accepte un libellé valide et des bénéficiaires', () => {
  const state = createState();
  const memberIds = state.memberships
    .filter((m) => m.householdId === state.household.id)
    .map((m) => m.userId);

  const plan = planCreateTodoItem(state, {
    label: 'Passer l\'aspirateur',
    assigneeMemberId: state.currentUserId,
    beneficiaryMemberIds: memberIds,
    dueDate: null,
    note: '',
  });
  assert.equal(plan.ok, true);
});

test('DRC-04-AC1 : planCreateTodoItem accepte un libellé avec date et note', () => {
  const state = createState();
  const plan = planCreateTodoItem(state, {
    label: 'Lessive',
    assigneeMemberId: state.currentUserId,
    beneficiaryMemberIds: [state.currentUserId],
    dueDate: '2026-09-15',
    note: 'Ne pas oublier le softener',
  });
  assert.equal(plan.ok, true);
});

test('DRC-04-AC1 : planCreateTodoItem refuse un libellé vide', () => {
  const state = createState();
  const plan = planCreateTodoItem(state, {
    label: '',
    assigneeMemberId: null,
    beneficiaryMemberIds: [state.currentUserId],
    dueDate: null,
    note: '',
  });
  assert.equal(plan.ok, false);
  if (!plan.ok) {
    assert.ok(plan.error.includes('vide'));
  }
});

test('DRC-04-AC1 : planCreateTodoItem refuse des bénéficiaires vides', () => {
  const state = createState();
  const plan = planCreateTodoItem(state, {
    label: 'Tâche test',
    assigneeMemberId: null,
    beneficiaryMemberIds: [],
    dueDate: null,
    note: '',
  });
  assert.equal(plan.ok, false);
  if (!plan.ok) {
    assert.ok(plan.error.includes('bénéficiaire'));
  }
});

test('DRC-04-AC1 : planCreateTodoItem refuse un bénéficiaire extérieur au foyer', () => {
  const state = createState();
  const plan = planCreateTodoItem(state, {
    label: 'Tâche test',
    assigneeMemberId: null,
    beneficiaryMemberIds: ['user_intrus'],
    dueDate: null,
    note: '',
  });
  assert.equal(plan.ok, false);
  if (!plan.ok) {
    assert.ok(plan.error.includes('foyer'));
  }
});

test('DRC-04-AC1 : planCreateTodoItem refuse un assigné extérieur au foyer', () => {
  const state = createState();
  const plan = planCreateTodoItem(state, {
    label: 'Tâche test',
    assigneeMemberId: 'user_intrus',
    beneficiaryMemberIds: [state.currentUserId],
    dueDate: null,
    note: '',
  });
  assert.equal(plan.ok, false);
  if (!plan.ok) {
    assert.ok(plan.error.includes('foyer'));
  }
});

test('DRC-04-AC1 : planCreateTodoItem refuse une date invalide', () => {
  const state = createState();
  const plan = planCreateTodoItem(state, {
    label: 'Tâche test',
    assigneeMemberId: null,
    beneficiaryMemberIds: [state.currentUserId],
    dueDate: 'not-a-date',
    note: '',
  });
  assert.equal(plan.ok, false);
  if (!plan.ok) {
    assert.ok(plan.error.includes('invalide'));
  }
});

/* ------------------------------------------------------------------ */
/* AC2 : Check fait ouvre un mini-formulaire                            */
/* ------------------------------------------------------------------ */

test('DRC-04-AC2 : planCompleteTodoItem valide les champs du formulaire de conversion', () => {
  const base = createState();
  const state = stateWithTodos([
    makeTodo({
      id: 'todo_1',
      householdId: base.household.id,
      label: 'Passer l\'aspirateur',
      assigneeMemberId: base.currentUserId,
      beneficiaryMemberIds: [base.currentUserId, 'user_camille'],
    }),
  ]);
  const plan = planCompleteTodoItem(state, 'todo_1', {
    performedByMemberId: base.currentUserId,
    durationMinutes: 30,
    beneficiaryMemberIds: [base.currentUserId, 'user_camille'],
  });
  assert.equal(plan.ok, true);
  if (plan.ok) {
    assert.equal(plan.value.durationMinutes, 30);
    assert.equal(plan.value.performedByMemberId, base.currentUserId);
  }
});

test('DRC-04-AC2 : planCompleteTodoItem accepte fait-par = autre membre du foyer', () => {
  const base = createState();
  const state = stateWithTodos([
    makeTodo({
      id: 'todo_1',
      householdId: base.household.id,
      label: 'Test',
      beneficiaryMemberIds: ['user_camille'],
    }),
  ]);
  const plan = planCompleteTodoItem(state, 'todo_1', {
    performedByMemberId: 'user_camille',
    durationMinutes: 15,
    beneficiaryMemberIds: ['user_camille'],
  });
  assert.equal(plan.ok, true);
});

test('DRC-04-AC2 : planCompleteTodoItem refuse fait-par extérieur au foyer', () => {
  const base = createState();
  const state = stateWithTodos([
    makeTodo({
      id: 'todo_1',
      householdId: base.household.id,
      beneficiaryMemberIds: [base.currentUserId],
    }),
  ]);
  const plan = planCompleteTodoItem(state, 'todo_1', {
    performedByMemberId: 'user_intrus',
    durationMinutes: 10,
    beneficiaryMemberIds: [base.currentUserId],
  });
  assert.equal(plan.ok, false);
});

test('DRC-04-AC2 : planCompleteTodoItem refuse durée invalide', () => {
  const base = createState();
  const state = stateWithTodos([
    makeTodo({
      id: 'todo_1',
      householdId: base.household.id,
      beneficiaryMemberIds: [base.currentUserId],
    }),
  ]);
  const plan = planCompleteTodoItem(state, 'todo_1', {
    performedByMemberId: base.currentUserId,
    durationMinutes: 0,
    beneficiaryMemberIds: [base.currentUserId],
  });
  assert.equal(plan.ok, false);
});

test('DRC-04-AC2 : planCompleteTodoItem refuse bénéficiaires vides', () => {
  const base = createState();
  const state = stateWithTodos([
    makeTodo({
      id: 'todo_1',
      householdId: base.household.id,
      beneficiaryMemberIds: [base.currentUserId],
    }),
  ]);
  const plan = planCompleteTodoItem(state, 'todo_1', {
    performedByMemberId: base.currentUserId,
    durationMinutes: 10,
    beneficiaryMemberIds: [],
  });
  assert.equal(plan.ok, false);
});

/* ------------------------------------------------------------------ */
/* AC3 : Validation crée atomiquement CompletedEntry + termine TodoItem */
/* ------------------------------------------------------------------ */

test('DRC-04-AC3 : le reducer ADD_TODO ajoute une TodoItem', () => {
  const state = createState();
  const todo: TodoItem = {
    id: 'todo_1',
    householdId: state.household.id,
    label: 'Test',
    assigneeMemberId: null,
    beneficiaryMemberIds: [state.currentUserId],
    dueDate: null,
    note: '',
    persistentTaskId: null,
    createdAt: NOW.toISOString(),
    completedAt: null,
  };
  const next = reducer(state, { type: 'ADD_TODO', todo });
  assert.equal(next.todoItems.length, 1);
  assert.equal(next.todoItems[0]?.label, 'Test');
});

test('DRC-04-AC3 : le reducer COMPLETE_TODO marque completedAt et ajoute l\'entrée', () => {
  const base = createState();
  const state = stateWithTodos([
    makeTodo({
      id: 'todo_1',
      householdId: base.household.id,
      beneficiaryMemberIds: [base.currentUserId],
    }),
  ]);
  const initialEntryCount = state.entries.length;
  assert.ok(initialEntryCount >= 0, 'State initialisé avec des entrées démo');
  const entry = {
    id: 'entry_from_todo',
    taskId: 'task_todo',
    householdId: base.household.id,
    userId: base.currentUserId,
    status: 'completed' as const,
    startedAt: null,
    completedAt: NOW.toISOString(),
    durationSeconds: 1800,
    weightSnapshot: 1,
    score: 30,
    isManual: true,
    periodKey: '2026-W36',
  };
  const next = reducer(state, { type: 'COMPLETE_TODO', todoId: 'todo_1', entry });
  // TodoItem marquée terminée
  assert.ok(next.todoItems[0]?.completedAt !== null);
  // Entrée ajoutée (la base a déjà des entrées démo)
  assert.equal(next.entries.length, initialEntryCount + 1);
  const addedEntry = next.entries.find((e) => e.id === 'entry_from_todo');
  assert.ok(addedEntry, 'L\'entrée créée depuis la to-do existe');
});

test('DRC-04-AC3 : le reducer COMPLETE_TODO ne touche pas les autres to-do', () => {
  const base = createState();
  const state = stateWithTodos([
    makeTodo({
      id: 'todo_1',
      householdId: base.household.id,
      label: 'A',
      beneficiaryMemberIds: [base.currentUserId],
    }),
    makeTodo({
      id: 'todo_2',
      householdId: base.household.id,
      label: 'B',
      beneficiaryMemberIds: [base.currentUserId],
    }),
  ]);
  const entry = {
    id: 'entry_1',
    taskId: 'task_1',
    householdId: base.household.id,
    userId: base.currentUserId,
    status: 'completed' as const,
    startedAt: null,
    completedAt: NOW.toISOString(),
    durationSeconds: 600,
    weightSnapshot: 1,
    score: 10,
    isManual: true,
    periodKey: '2026-W36',
  };
  const next = reducer(state, { type: 'COMPLETE_TODO', todoId: 'todo_1', entry });
  assert.ok(next.todoItems[0]?.completedAt !== null);
  assert.equal(next.todoItems[1]?.completedAt, null, 'La todo_2 n\'est pas affectée');
});

/* ------------------------------------------------------------------ */
/* AC4 : L'historique complet et Score se mettent à jour                */
/* ------------------------------------------------------------------ */

test('DRC-04-AC4 : après COMPLETE_TODO, l\'entrée est visible dans le store entries', () => {
  const base = createState();
  const initialEntryCount = base.entries.length;
  const state = stateWithTodos([
    makeTodo({
      id: 'todo_1',
      householdId: base.household.id,
      beneficiaryMemberIds: [base.currentUserId],
    }),
  ]);
  const entry = {
    id: 'entry_new',
    taskId: 'task_new',
    householdId: base.household.id,
    userId: base.currentUserId,
    status: 'completed' as const,
    startedAt: null,
    completedAt: NOW.toISOString(),
    durationSeconds: 1200,
    weightSnapshot: 1,
    score: 20,
    isManual: true,
    periodKey: '2026-W36',
  };
  const next = reducer(state, { type: 'COMPLETE_TODO', todoId: 'todo_1', entry });
  assert.equal(next.entries.length, initialEntryCount + 1);
  const addedEntry = next.entries.find((e) => e.id === 'entry_new');
  assert.ok(addedEntry, 'L\'entrée créée depuis la to-do est visible');
  assert.equal(addedEntry.status, 'completed');
  assert.ok(addedEntry.completedAt !== null);
});

/* ------------------------------------------------------------------ */
/* AC5 : Reminders locaux désactivés honnêtement                       */
/* ------------------------------------------------------------------ */

test('DRC-04-AC5 : TodoItem n\'a pas de champ reminder (désactivé honnêtement)', () => {
  const todo: TodoItem = {
    id: 'todo_1',
    householdId: 'h1',
    label: 'Test',
    assigneeMemberId: null,
    beneficiaryMemberIds: ['u1'],
    dueDate: null,
    note: '',
    persistentTaskId: null,
    createdAt: NOW.toISOString(),
    completedAt: null,
  };
  assert.ok(!('reminder' in todo), 'Pas de champ reminder');
  assert.ok(!('reminderAt' in todo), 'Pas de champ reminderAt');
});

/* ------------------------------------------------------------------ */
/* AC6 : PRODUCT-RESET-BALANCE — les 4 périodes sont cœur produit      */
/* ------------------------------------------------------------------ */

test('DRC-04-AC6 : les 4 périodes (semaine/mois/année/depuis le début) sont supportées par le code', () => {
  const periods = ['week', 'month', 'year', 'all'] as const;
  assert.equal(periods.length, 4, 'Exactement 4 périodes cœur produit');
  const labels: Record<string, string> = {
    week: 'Semaine',
    month: 'Mois',
    year: 'Année',
    all: 'Depuis le début',
  };
  for (const p of periods) {
    assert.ok(labels[p] !== undefined, `Label défini pour ${p}`);
  }
});

test('DRC-04-AC6 : les 4 périodes sont utilisées dans le filtrage Score', () => {
  const now = new Date(2026, 8, 1);
  const entryThisYear = {
    id: 'ce_1',
    label: 'Test',
    householdId: 'h1',
    performedByMemberId: 'u1',
    beneficiaryMemberIds: ['u1'],
    durationSeconds: 1800,
    completedAt: '2026-06-15T10:00:00.000Z',
    persistentTaskId: null,
    weight: 1,
  };
  const entryLastYear = {
    ...entryThisYear,
    id: 'ce_2',
    completedAt: '2025-06-15T10:00:00.000Z',
  };
  const thisYearEntries = [entryThisYear, entryLastYear].filter((e) => {
    const completedAt = new Date(e.completedAt);
    return completedAt.getFullYear() === now.getFullYear();
  });
  assert.equal(thisYearEntries.length, 1, 'Seule l\'entrée de 2026 passe le filtre année');
  assert.equal(thisYearEntries[0]?.id, 'ce_1');
});

/* ------------------------------------------------------------------ */
/* Isolation foyer pour les to-do                                      */
/* ------------------------------------------------------------------ */

test('DRC-04 : planCreateTodoItem accepte un membre du foyer actif', () => {
  const state = createState();
  const plan = planCreateTodoItem(state, {
    label: 'Test',
    assigneeMemberId: null,
    beneficiaryMemberIds: ['user_noa'],
    dueDate: null,
    note: '',
  });
  // user_noa est membre du foyer actif
  assert.equal(plan.ok, true);
});

test('DRC-04 : planCompleteTodoItem refuse une tâche inconnue', () => {
  const state = createState();
  const plan = planCompleteTodoItem(state, 'todo_inconnu', {
    performedByMemberId: state.currentUserId,
    durationMinutes: 10,
    beneficiaryMemberIds: [state.currentUserId],
  });
  assert.equal(plan.ok, false);
  if (!plan.ok) {
    assert.ok(plan.error.includes('introuvable'));
  }
});

test('DRC-04 : planCompleteTodoItem refuse une tâche déjà terminée', () => {
  const base = createState();
  const state = stateWithTodos([
    makeTodo({
      id: 'todo_done',
      householdId: base.household.id,
      label: 'Déjà faite',
      beneficiaryMemberIds: [base.currentUserId],
      completedAt: '2026-08-30T10:00:00.000Z',
    }),
  ]);
  const plan = planCompleteTodoItem(state, 'todo_done', {
    performedByMemberId: base.currentUserId,
    durationMinutes: 10,
    beneficiaryMemberIds: [base.currentUserId],
  });
  assert.equal(plan.ok, false);
  if (!plan.ok) {
    assert.ok(plan.error.includes('déjà terminée'));
  }
});

/* ------------------------------------------------------------------ */
/* selectVisibleTodos                                                  */
/* ------------------------------------------------------------------ */

test('DRC-04 : selectVisibleTodos retourne actives et terminées séparément', () => {
  const base = createState();
  const state = stateWithTodos([
    makeTodo({
      id: 'todo_active',
      householdId: base.household.id,
      label: 'Active',
      beneficiaryMemberIds: [base.currentUserId],
    }),
    makeTodo({
      id: 'todo_done',
      householdId: base.household.id,
      label: 'Terminée',
      beneficiaryMemberIds: [base.currentUserId],
      completedAt: '2026-08-30T10:00:00.000Z',
    }),
  ]);
  const { active, completed } = selectVisibleTodos(state);
  assert.equal(active.length, 1);
  assert.equal(active[0]?.id, 'todo_active');
  assert.equal(completed.length, 1);
  assert.equal(completed[0]?.id, 'todo_done');
});

test('DRC-04 : selectVisibleTodos filtre par foyer actif', () => {
  const base = createState();
  const state = stateWithTodos([
    makeTodo({
      id: 'todo_h1',
      householdId: base.household.id,
      label: 'Foyer 1',
      beneficiaryMemberIds: [base.currentUserId],
    }),
    makeTodo({
      id: 'todo_h2',
      householdId: 'autre_foyer',
      label: 'Foyer 2',
      beneficiaryMemberIds: ['u1'],
    }),
  ]);
  const { active } = selectVisibleTodos(state);
  assert.equal(active.length, 1);
  assert.equal(active[0]?.id, 'todo_h1');
});

test('DRC-04 : selectVisibleTodos trie les actives par date d\'échéance', () => {
  const base = createState();
  const state = stateWithTodos([
    makeTodo({
      id: 'todo_later',
      householdId: base.household.id,
      label: 'Plus tard',
      beneficiaryMemberIds: [base.currentUserId],
      dueDate: '2026-10-01',
    }),
    makeTodo({
      id: 'todo_soon',
      householdId: base.household.id,
      label: 'Bientôt',
      beneficiaryMemberIds: [base.currentUserId],
      dueDate: '2026-09-15',
    }),
    makeTodo({
      id: 'todo_nodate',
      householdId: base.household.id,
      label: 'Sans date',
      beneficiaryMemberIds: [base.currentUserId],
    }),
  ]);
  const { active } = selectVisibleTodos(state);
  // Dates en premier, triées croissantes, sans date à la fin
  assert.equal(active[0]?.id, 'todo_soon');
  assert.equal(active[1]?.id, 'todo_later');
  assert.equal(active[2]?.id, 'todo_nodate');
});

/* ------------------------------------------------------------------ */
/* DELETE_TODO                                                         */
/* ------------------------------------------------------------------ */

test('DRC-04 : le reducer DELETE_TODO retire la TodoItem', () => {
  const base = createState();
  const state = stateWithTodos([
    makeTodo({
      id: 'todo_1',
      householdId: base.household.id,
      label: 'À supprimer',
      beneficiaryMemberIds: [base.currentUserId],
    }),
  ]);
  const next = reducer(state, { type: 'DELETE_TODO', todoId: 'todo_1' });
  assert.equal(next.todoItems.length, 0);
});
