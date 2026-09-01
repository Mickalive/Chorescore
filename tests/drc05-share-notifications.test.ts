import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildScoreShareText,
  buildEntryShareText,
  buildTodoShareText,
  formatDurationHuman,
} from '../src/services/shareContent.js';
import {
  getNotificationGatewayStatus,
  requestNotificationPermission,
  getCalendarGatewayStatus,
} from '../src/services/notificationGateway.js';

/* ------------------------------------------------------------------ */
/* DRC-05 : Partage système natif — tests unitaires                    */
/* ------------------------------------------------------------------ */

test('formatDurationHuman formate correctement les durées', () => {
  assert.equal(formatDurationHuman(0), '0 min');
  assert.equal(formatDurationHuman(30), '30 min');
  assert.equal(formatDurationHuman(60), '1 h');
  assert.equal(formatDurationHuman(90), '1 h 30');
  assert.equal(formatDurationHuman(125), '2 h 5');
});

test('buildScoreShareText produit un texte informatif sans commentaire moral', () => {
  const text = buildScoreShareText({
    householdName: 'Famille Test',
    periodLabel: 'Semaine',
    filterLabel: 'Toutes',
    totalMinutes: 180,
    rows: [
      { name: 'Alice', durationMinutes: 120, rank: 1 },
      { name: 'Bob', durationMinutes: 60, rank: 2 },
    ],
  });

  assert.ok(text.includes('ChoreScore'), 'contient le header');
  assert.ok(text.includes('Famille Test'), 'contient le nom du foyer');
  assert.ok(text.includes('Semaine'), 'contient la période');
  assert.ok(text.includes('Toutes'), 'contient le filtre');
  assert.ok(text.includes('3 h'), 'formate le temps total');
  assert.ok(text.includes('#1 Alice : 2 h'), 'formate le rang du membre');
  assert.ok(text.includes('#2 Bob : 1 h'), 'formate le second membre');
  assert.ok(text.includes('#ChargeMentale'), 'contient le hashtag');
  // Aucun commentaire moral ou relationnel
  assert.ok(!text.includes('discutez'), 'pas de commentaire moral');
  assert.ok(!text.includes('conseil'), 'pas de conseil relationnel');
  assert.ok(!text.includes('courage'), 'pas d\'encouragement moralisateur');
  assert.ok(!text.includes('verdict'), 'pas de pseudo-verdict');
});

test('buildEntryShareText produit un texte compact et informatif', () => {
  const text = buildEntryShareText({
    taskName: 'Vaisselle',
    durationMinutes: 25,
    performedBy: 'Alice',
    date: '15 mars',
  });

  assert.ok(text.includes('ChoreScore'), 'contient le header');
  assert.ok(text.includes('Vaisselle — 25 min'), 'contient tâche et durée');
  assert.ok(text.includes('Fait par Alice'), 'contient le performer');
  assert.ok(text.includes('15 mars'), 'contient la date');
  assert.ok(text.includes('#ChargeMentale'), 'contient le hashtag');
});

test('buildTodoShareText produit un texte avec les champs pertinents', () => {
  const text = buildTodoShareText({
    label: 'Sortir les poubelles',
    assigneeName: 'Bob',
    dueDate: '20 mars',
    note: 'Avant 18h',
  });

  assert.ok(text.includes('ChoreScore'), 'contient le header');
  assert.ok(text.includes('Sortir les poubelles'), 'contient le libellé');
  assert.ok(text.includes('Assigné à Bob'), 'contient l\'assigné');
  assert.ok(text.includes('20 mars'), 'contient l\'échéance');
  assert.ok(text.includes('Avant 18h'), 'contient la note');
});

test('buildTodoShareText gère les champs optionnels', () => {
  const text = buildTodoShareText({
    label: 'Tâche simple',
    assigneeName: null,
    dueDate: null,
    note: '',
  });

  assert.ok(text.includes('Tâche simple'), 'contient le libellé');
  assert.ok(!text.includes('Assigné'), 'pas d\'assigné');
  assert.ok(!text.includes('Échéance'), 'pas d\'échéance');
  assert.ok(!text.includes('Note'), 'pas de note');
});

/* ------------------------------------------------------------------ */
/* DRC-05 : Notifications locales — gateway honnête                    */
/* ------------------------------------------------------------------ */

test('le gateway de notifications signale un support honnête', () => {
  const status = getNotificationGatewayStatus();
  assert.equal(status.supported, false, 'non supporté en mode démo');
  assert.equal(status.permission, 'undetermined', 'permission indéterminée');
  assert.ok(status.message !== null && status.message.length > 0, 'message honnête fourni');
});

test('la demande de permission retourne denied en mode démo', async () => {
  const result = await requestNotificationPermission();
  assert.equal(result, 'denied', 'permission refusée en mode démo');
});

test('le gateway calendrier signale un support honnête', () => {
  const status = getCalendarGatewayStatus();
  assert.equal(status.supported, false, 'non supporté en mode démo');
  assert.ok(status.message !== null && status.message.length > 0, 'message honnête fourni');
});
