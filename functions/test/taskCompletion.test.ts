import assert from "node:assert/strict";
import test from "node:test";

import {
  ALL_COMPLETION_ROLES,
  decideTaskCompletion,
  TaskCompletionInput,
} from "../src/taskCompletion";

const NOW = Date.UTC(2026, 7, 24, 12);
const START = NOW - 60_000;

function validInput(overrides?: Partial<TaskCompletionInput>): TaskCompletionInput {
  return {
    caller: {
      authenticated: true,
      appCheckAttested: true,
      emailVerified: true,
      uid: "user_1",
    },
    membership: {
      exists: true,
      status: "active",
      role: "member",
    },
    task: {
      exists: true,
      ownerUid: "user_1",
      status: "in_progress",
      startTimeMs: START,
      effectiveWeight: 3,
    },
    operation: {
      exists: false,
      resourceId: null,
      durationSeconds: null,
      score: null,
    },
    expectedTaskId: "task_a1",
    nowMs: NOW,
    ...overrides,
  };
}

test("une complétion nominale calcule durée et score côté serveur", () => {
  assert.deepEqual(decideTaskCompletion(validInput()), {
    outcome: "complete",
    durationSeconds: 60,
    score: 3,
  });

  assert.deepEqual(
    decideTaskCompletion(
      validInput({ task: { exists: true, ownerUid: "user_1", status: "in_progress", startTimeMs: NOW - 91_000, effectiveWeight: 3 } }),
    ),
    { outcome: "complete", durationSeconds: 91, score: 4.55 },
  );
});

test("les bornes de poids figé 1 et 1000 sont acceptées", () => {
  for (const weight of [1, 1000]) {
    const decision = decideTaskCompletion(
      validInput({
        task: { exists: true, ownerUid: "user_1", status: "in_progress", startTimeMs: START, effectiveWeight: weight },
      }),
    );
    assert.equal(decision.outcome, "complete");
  }
});

test("un appel sans Authentification Firebase est refusé", () => {
  assert.deepEqual(
    decideTaskCompletion(validInput({ caller: { authenticated: false, appCheckAttested: true, emailVerified: true, uid: "user_1" } })),
    { outcome: "reject", code: "unauthenticated", message: "Authentification requise." },
  );
  assert.equal(
    decideTaskCompletion(validInput({ caller: { authenticated: true, appCheckAttested: true, emailVerified: true, uid: 42 } })).outcome,
    "reject",
  );
  assert.equal(
    decideTaskCompletion(validInput({ caller: { authenticated: true, appCheckAttested: true, emailVerified: true, uid: "" } })).outcome,
    "reject",
  );
});

test("un appel sans attestation App Check est refusé", () => {
  assert.deepEqual(
    decideTaskCompletion(validInput({ caller: { authenticated: true, appCheckAttested: false, emailVerified: true, uid: "user_1" } })),
    { outcome: "reject", code: "failed-precondition", message: "Attestation App Check requise." },
  );
});

test("un appel avec une adresse email non vérifiée est refusé", () => {
  const unreadableEmailFlags: readonly unknown[] = [false, undefined, "yes"];
  for (const flag of unreadableEmailFlags) {
    assert.equal(
      decideTaskCompletion(
        validInput({
          caller: {
            authenticated: true,
            appCheckAttested: true,
            // Défense profonde : la valeur traverse une frontière et doit être
            // strictement `true`, jamais coercée.
            emailVerified: flag as boolean,
            uid: "user_1",
          },
        }),
      ).outcome,
      "reject",
    );
  }
});

test("un appelant hors du foyer ciblé est refusé, même propriétaire de la tâche", () => {
  // L'utilisateur possède la tâche mais n'a plus d'adhésion dans ce foyer.
  assert.deepEqual(
    decideTaskCompletion(validInput({ membership: { exists: false, status: undefined, role: undefined } })),
    { outcome: "reject", code: "permission-denied", message: "Accès au foyer refusé." },
  );
  assert.equal(
    decideTaskCompletion(validInput({ membership: { exists: true, status: "removed", role: "member" } })).outcome,
    "reject",
  );
  assert.equal(
    decideTaskCompletion(validInput({ membership: { exists: true, status: undefined, role: "member" } })).outcome,
    "reject",
  );
});

test("un rôle stocké illisible ou insuffisant est refusé", () => {
  for (const role of [42, "superadmin", null]) {
    assert.equal(
      decideTaskCompletion(validInput({ membership: { exists: true, status: "active", role } })).outcome,
      "reject",
    );
  }
  assert.deepEqual(
    decideTaskCompletion(validInput({ acceptedRoles: ["owner", "admin"] })),
    { outcome: "reject", code: "permission-denied", message: "Autorisation insuffisante." },
  );
});

test("l'isolation entre deux foyers : l'adhésion doit exister dans le foyer ciblé", () => {
  // Foyer A : user_1 membre actif. Foyer B : user_1 exclu mais tâche encore
  // à son nom. Une requête ciblant le foyer B est refusée malgré la propriété.
  const householdBMembership = { exists: false, status: undefined, role: undefined };
  const householdBTask = { exists: true, ownerUid: "user_1", status: "in_progress", startTimeMs: START, effectiveWeight: 3 };
  assert.deepEqual(
    decideTaskCompletion(
      validInput({
        membership: householdBMembership,
        task: householdBTask,
        expectedTaskId: "task_b1",
      }),
    ),
    { outcome: "reject", code: "permission-denied", message: "Accès au foyer refusé." },
  );

  // Dans le foyer A où il est membre, la même personne complète sa tâche.
  assert.equal(
    decideTaskCompletion(validInput({ expectedTaskId: "task_a1" })).outcome,
    "complete",
  );
});

test("une clé d'idempotence consommée sur un autre foyer échoue fermée sans fuir de résultat", () => {
  // La clé a servi pour task_b1 (foyer B) ; la requête vise task_a1 (foyer A).
  const decision = decideTaskCompletion(
    validInput({
      operation: { exists: true, resourceId: "task_b1", durationSeconds: 120, score: 6 },
    }),
  );
  assert.deepEqual(decision, { outcome: "fail_closed", reason: "invalid_idempotency_record" });
});

test("une double soumission rejoue le résultat initial sans nouvelle écriture", () => {
  assert.deepEqual(
    decideTaskCompletion(
      validInput({
        operation: { exists: true, resourceId: "task_a1", durationSeconds: 120, score: 6 },
      }),
    ),
    { outcome: "replay", durationSeconds: 120, score: 6 },
  );
});

test("un enregistrement d'idempotence illisible échoue fermé", () => {
  for (const operation of [
    { exists: true, resourceId: undefined, durationSeconds: 120, score: 6 },
    { exists: true, resourceId: "task_a1", durationSeconds: Number.NaN, score: 6 },
    { exists: true, resourceId: "task_a1", durationSeconds: Number.POSITIVE_INFINITY, score: 6 },
    { exists: true, resourceId: "task_a1", durationSeconds: "120", score: 6 },
    { exists: true, resourceId: "task_a1", durationSeconds: 120, score: null },
  ]) {
    assert.deepEqual(
      decideTaskCompletion(validInput({ operation })),
      { outcome: "fail_closed", reason: "invalid_idempotency_record" },
    );
  }
});

test("un enregistrement d'idempotence incohérent avec les écritures serveur échoue fermé", () => {
  // Le serveur n'écrit qu'une durée entière entre 1 et 86 400 s et un score
  // strictement positif : toute autre valeur stockée trahit une corruption.
  for (const operation of [
    { exists: true, resourceId: "task_a1", durationSeconds: -5, score: 6 },
    { exists: true, resourceId: "task_a1", durationSeconds: 0, score: 6 },
    { exists: true, resourceId: "task_a1", durationSeconds: 2.5, score: 6 },
    { exists: true, resourceId: "task_a1", durationSeconds: 86_401, score: 6 },
    { exists: true, resourceId: "task_a1", durationSeconds: 120, score: 0 },
    { exists: true, resourceId: "task_a1", durationSeconds: 120, score: -1 },
  ]) {
    assert.deepEqual(
      decideTaskCompletion(validInput({ operation })),
      { outcome: "fail_closed", reason: "invalid_idempotency_record" },
    );
  }
});

test("la porte d'adhésion précède le rejeu : plus de membre, plus de résultat", () => {
  // Une clé déjà consommée ne rend aucun service à une personne exclue du
  // foyer entre-temps : l'ordre adhésion puis idempotence est verrouillé.
  const decision = decideTaskCompletion(
    validInput({
      membership: { exists: false, status: undefined, role: undefined },
      operation: { exists: true, resourceId: "task_a1", durationSeconds: 120, score: 6 },
    }),
  );
  assert.deepEqual(decision, {
    outcome: "reject",
    code: "permission-denied",
    message: "Accès au foyer refusé.",
  });
});

test("une tâche introuvable ou possédée par un autre membre est refusée", () => {
  assert.deepEqual(
    decideTaskCompletion(validInput({ task: { exists: false, ownerUid: undefined, status: undefined, startTimeMs: null, effectiveWeight: undefined } })),
    { outcome: "reject", code: "not-found", message: "Tâche introuvable." },
  );
  assert.deepEqual(
    decideTaskCompletion(validInput({ task: { exists: true, ownerUid: "user_2", status: "in_progress", startTimeMs: START, effectiveWeight: 3 } })),
    { outcome: "reject", code: "permission-denied", message: "Cette tâche appartient à un autre membre." },
  );
});

test("une tâche déjà terminée ou au début illisible ne se complète pas", () => {
  for (const task of [
    { exists: true, ownerUid: "user_1", status: "completed", startTimeMs: START, effectiveWeight: 3 },
    { exists: true, ownerUid: "user_1", status: undefined, startTimeMs: START, effectiveWeight: 3 },
    { exists: true, ownerUid: "user_1", status: "in_progress", startTimeMs: null, effectiveWeight: 3 },
    { exists: true, ownerUid: "user_1", status: "in_progress", startTimeMs: "2026-08-24", effectiveWeight: 3 },
    { exists: true, ownerUid: "user_1", status: "in_progress", startTimeMs: Number.NaN, effectiveWeight: 3 },
  ]) {
    assert.deepEqual(
      decideTaskCompletion(validInput({ task })),
      { outcome: "reject", code: "failed-precondition", message: "Cette tâche ne peut pas être terminée." },
    );
  }
});

test("un poids figé illisible ou hors bornes est refusé sans coercion", () => {
  for (const effectiveWeight of [undefined, null, "3", 2.5, 0, -1, 1001, Number.NaN]) {
    assert.deepEqual(
      decideTaskCompletion(
        validInput({ task: { exists: true, ownerUid: "user_1", status: "in_progress", startTimeMs: START, effectiveWeight } }),
      ),
      { outcome: "reject", code: "invalid-argument", message: "weight doit être un entier entre 1 et 1000." },
    );
  }
});

test("la durée vient du temps serveur et reste bornée à 24 heures", () => {
  assert.deepEqual(
    decideTaskCompletion(
      validInput({
        task: { exists: true, ownerUid: "user_1", status: "in_progress", startTimeMs: NOW - 86_401_000, effectiveWeight: 1 },
      }),
    ),
    {
      outcome: "reject",
      code: "failed-precondition",
      message: "Une tâche ne peut pas dépasser 24 heures. Démarrez une nouvelle tâche.",
    },
  );
  const exactLimit = decideTaskCompletion(
    validInput({
      task: { exists: true, ownerUid: "user_1", status: "in_progress", startTimeMs: NOW - 86_400_000, effectiveWeight: 1 },
    }),
  );
  assert.deepEqual(exactLimit, { outcome: "complete", durationSeconds: 86_400, score: 1440 });

  // Horloge serveur en avance sur le début stocké : borné à 1 seconde.
  assert.deepEqual(
    decideTaskCompletion(
      validInput({
        task: { exists: true, ownerUid: "user_1", status: "in_progress", startTimeMs: NOW + 30_000, effectiveWeight: 1 },
      }),
    ),
    { outcome: "complete", durationSeconds: 1, score: 1 / 60 },
  );
});

test("une enveloppe de requête serveur invalide échoue fermée", () => {
  for (const nowMs of [Number.NaN, 1.5, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(
      decideTaskCompletion(validInput({ nowMs })),
      { outcome: "fail_closed", reason: "invalid_request_envelope" },
    );
  }
  assert.deepEqual(
    decideTaskCompletion(validInput({ expectedTaskId: "" })),
    { outcome: "fail_closed", reason: "invalid_request_envelope" },
  );
});

test("tous les rôles connus peuvent terminer leur propre tâche par défaut", () => {
  for (const role of ALL_COMPLETION_ROLES) {
    const decision = decideTaskCompletion(
      validInput({ membership: { exists: true, status: "active", role } }),
    );
    assert.equal(decision.outcome, "complete");
  }
});
