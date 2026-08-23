import assert from 'node:assert/strict';
import test from 'node:test';
import { DemoAppService } from '../src/services/demoService.js';
import { ProductionAppService } from '../src/services/productionService.js';
import { ProductionModeDisabledError } from '../src/services/appService.js';
import {
  DemoAnalyticsService,
  ProductionAnalyticsService,
} from '../src/services/analyticsService.js';
import { analyticsService, appDataService } from '../src/services/index.js';
import { calculateScore } from '../src/domain/scoring.js';

const NOW = new Date(2026, 7, 26, 12, 0, 0);
const TEN_OCLOCK = new Date(2026, 7, 26, 10, 0, 0);

test('l’adaptateur démo hors ligne est le service actif par défaut', () => {
  assert.equal(appDataService.mode, 'demo');
  assert.ok(analyticsService instanceof DemoAnalyticsService);
});

test('le service démo crée une tâche avec un nom normalisé', () => {
  const service = new DemoAppService();
  const task = service.createTask({
    householdId: 'household_rivage',
    name: '  Ranger\n   le salon  ',
    category: 'cleaning',
    weight: 3,
    now: NOW,
  });
  assert.equal(task.name, 'Ranger le salon');
  assert.equal(task.householdId, 'household_rivage');
  assert.equal(task.weight, 3);
  assert.equal(task.active, true);
});

test('le service démo démarre un chrono en cours sans score', () => {
  const service = new DemoAppService();
  const task = service.createTask({
    householdId: 'household_rivage',
    name: 'Vaisselle',
    category: 'dishes',
    weight: 2,
    now: NOW,
  });
  const entry = service.startTimer({
    householdId: 'household_rivage',
    userId: 'user_noa',
    task,
    effectiveWeight: 2,
    now: NOW,
  });
  assert.equal(entry.status, 'in_progress');
  assert.equal(entry.score, 0);
  assert.equal(entry.durationSeconds, 0);
  assert.equal(entry.weightSnapshot, 2);
  assert.equal(entry.startedAt !== null, true);
});

test('le service démo calcule durée et score à la fin du chrono', () => {
  const service = new DemoAppService();
  const completed = service.completeTimer({
    entry: {
      id: 'entry_1',
      taskId: 'task_dishes',
      householdId: 'household_rivage',
      userId: 'user_noa',
      status: 'in_progress',
      startedAt: TEN_OCLOCK.toISOString(),
      completedAt: null,
      durationSeconds: 0,
      weightSnapshot: 2,
      score: 0,
      isManual: false,
      periodKey: '2026-W35',
    },
    now: new Date(2026, 7, 26, 10, 45, 0),
  });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.durationSeconds, 2700);
  assert.equal(completed.score, 90);
});

test('le service démo conserve le score fractionnaire sans arrondir', () => {
  const service = new DemoAppService();
  const completed = service.completeTimer({
    entry: {
      id: 'entry_1',
      taskId: 'task_dishes',
      householdId: 'household_rivage',
      userId: 'user_noa',
      status: 'in_progress',
      startedAt: TEN_OCLOCK.toISOString(),
      completedAt: null,
      durationSeconds: 0,
      weightSnapshot: 2,
      score: 0,
      isManual: false,
      periodKey: '2026-W35',
    },
    now: new Date(TEN_OCLOCK.getTime() + 45_000),
  });
  assert.equal(completed.durationSeconds, 45);
  assert.equal(completed.score, 1.5);
});

test('le service démo borne la durée d’un chrono à une seconde minimum', () => {
  const service = new DemoAppService();
  const completed = service.completeTimer({
    entry: {
      id: 'entry_1',
      taskId: 'task_dishes',
      householdId: 'household_rivage',
      userId: 'user_noa',
      status: 'in_progress',
      startedAt: TEN_OCLOCK.toISOString(),
      completedAt: null,
      durationSeconds: 0,
      weightSnapshot: 2,
      score: 0,
      isManual: false,
      periodKey: '2026-W35',
    },
    now: new Date(TEN_OCLOCK.getTime() + 400),
  });
  assert.equal(completed.durationSeconds, 1);
  assert.equal(completed.score, calculateScore(1, 2));
});

test('le service démo exige une heure de départ pour terminer un chrono', () => {
  const service = new DemoAppService();
  assert.throws(
    () =>
      service.completeTimer({
        entry: {
          id: 'entry_1',
          taskId: 'task_dishes',
          householdId: 'household_rivage',
          userId: 'user_noa',
          status: 'in_progress',
          startedAt: null,
          completedAt: null,
          durationSeconds: 0,
          weightSnapshot: 2,
          score: 0,
          isManual: false,
          periodKey: '2026-W35',
        },
        now: NOW,
      }),
    /heure de départ/,
  );
});

test('le service démo calcule une saisie manuelle en temps brut', () => {
  const service = new DemoAppService();
  const task = service.createTask({
    householdId: 'household_rivage',
    name: 'Lessive',
    category: 'laundry',
    weight: 2,
    now: NOW,
  });
  const entry = service.createManualEntry({
    householdId: 'household_rivage',
    userId: 'user_camille',
    task,
    effectiveWeight: 2,
    durationMinutes: 30,
    now: NOW,
  });
  assert.equal(entry.isManual, true);
  assert.equal(entry.startedAt, null);
  assert.equal(entry.durationSeconds, 1800);
  assert.equal(entry.score, 60);
  assert.equal(entry.status, 'completed');
});

test('l’adaptateur de production échoue fermé sur chaque opération', () => {
  const service = new ProductionAppService();
  const task = {
    id: 'task_x',
    householdId: 'household_x',
    name: 'X',
    category: 'other' as const,
    weight: 1,
    active: true,
    createdAt: NOW.toISOString(),
  };
  const entry = {
    id: 'entry_x',
    taskId: 'task_x',
    householdId: 'household_x',
    userId: 'user_x',
    status: 'in_progress' as const,
    startedAt: TEN_OCLOCK.toISOString(),
    completedAt: null,
    durationSeconds: 0,
    weightSnapshot: 1,
    score: 0,
    isManual: false,
    periodKey: '2026-W35',
  };
  assert.throws(() => service.getInitialSnapshot(), ProductionModeDisabledError);
  assert.throws(
    () =>
      service.createTask({
        householdId: 'household_x',
        name: 'X',
        category: 'other',
        weight: 1,
        now: NOW,
      }),
    ProductionModeDisabledError,
  );
  assert.throws(
    () =>
      service.startTimer({
        householdId: 'household_x',
        userId: 'user_x',
        task,
        effectiveWeight: 1,
        now: NOW,
      }),
    ProductionModeDisabledError,
  );
  assert.throws(() => service.completeTimer({ entry, now: NOW }), ProductionModeDisabledError);
  assert.throws(
    () =>
      service.createManualEntry({
        householdId: 'household_x',
        userId: 'user_x',
        task,
        effectiveWeight: 1,
        durationMinutes: 5,
        now: NOW,
      }),
    ProductionModeDisabledError,
  );
});

test('les analytics de démonstration restent désactivés par défaut', () => {
  const service = new DemoAnalyticsService();
  service.track({ name: 'task_completed', occurredAt: NOW.toISOString() });
  assert.equal(service.getInMemoryEventCount(), 0);
});

test('les analytics de démonstration comptent après consentement et purgent à la révocation', () => {
  const service = new DemoAnalyticsService();
  service.setConsent(true);
  service.track({ name: 'feature_opened', occurredAt: NOW.toISOString() });
  service.track({ name: 'plan_previewed', occurredAt: NOW.toISOString() });
  assert.equal(service.getInMemoryEventCount(), 2);
  service.setConsent(false);
  assert.equal(service.getInMemoryEventCount(), 0);
  service.track({ name: 'task_completed', occurredAt: NOW.toISOString() });
  assert.equal(service.getInMemoryEventCount(), 0);
});

test('les analytics de production sont interdits et neutres', () => {
  const service = new ProductionAnalyticsService();
  assert.throws(() => service.setConsent(true), /désactivés/);
  assert.throws(() => service.track({ name: 'task_completed', occurredAt: NOW.toISOString() }), /désactivés/);
  assert.equal(service.getInMemoryEventCount(), 0);
});

