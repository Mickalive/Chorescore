/**
 * Décision d'autorisation et d'idempotence pour la complétion d'une tâche,
 * en logique pure.
 *
 * Invariants constitutionnels (MAIN_PROMPT.md §5 et §7) :
 * - le client est non fiable : l'identité, l'attestation App Check, l'email
 *   vérifié, l'adhésion au foyer, le rôle, la propriété de l'entrée, l'état de
 *   la tâche et le temps de référence sont décidés ici, jamais côté client ;
 * - le score est calculé côté serveur à partir du poids figé dans la tâche ;
 * - une double soumission rejoue le résultat initial sans nouvelle écriture ;
 * - un enregistrement d'idempotence illisible échoue fermé plutôt que de
 *   rendre un résultat inventé.
 *
 * Toute donnée stockée lue dans Firestore arrive comme `unknown` : un champ
 * présent mais illisible conduit à un refus, jamais à une coercion implicite.
 * Ce module ne dépend ni de Firestore ni d'Admin SDK afin de rester testable
 * hors émulateur et sans effet de bord ; il ne jette jamais, il décide.
 */

import { calculateScore } from "./domain";

export type CompletionRole = "owner" | "admin" | "member";

export const ALL_COMPLETION_ROLES: readonly CompletionRole[] = [
  "owner",
  "admin",
  "member",
];

/** Identité déjà filtrée par `requireCaller`, re-vérifiée ici en défense profonde. */
export interface CompletionCaller {
  readonly authenticated: boolean;
  readonly appCheckAttested: boolean;
  readonly emailVerified: boolean;
  readonly uid: unknown;
}

/** Document `households/{id}/members/{uid}`, tel que lu dans la transaction. */
export interface CompletionMembership {
  readonly exists: boolean;
  readonly status: unknown;
  readonly role: unknown;
}

/** Document `households/{id}/tasks/{taskId}`, tel que lu dans la transaction. */
export interface CompletionTask {
  readonly exists: boolean;
  readonly ownerUid: unknown;
  readonly status: unknown;
  /** `startTime.toMillis()` si Timestamp lisible, sinon toute autre valeur. */
  readonly startTimeMs: unknown;
  /** Poids figé à la création (`templateSnapshot.effectiveWeight`). */
  readonly effectiveWeight: unknown;
}

/** Document `operationKeys/{uid}:{action}:{key}` (clé d'idempotence). */
export interface CompletionOperation {
  readonly exists: boolean;
  readonly resourceId: unknown;
  readonly durationSeconds: unknown;
  readonly score: unknown;
}

export type CompletionRejectionCode =
  | "unauthenticated"
  | "failed-precondition"
  | "permission-denied"
  | "not-found"
  | "invalid-argument";

export type TaskCompletionDecision =
  | {
      readonly outcome: "reject";
      readonly code: CompletionRejectionCode;
      readonly message: string;
    }
  | {
      readonly outcome: "fail_closed";
      readonly reason: "invalid_idempotency_record" | "invalid_request_envelope";
    }
  | {
      readonly outcome: "replay";
      readonly durationSeconds: number;
      readonly score: number;
    }
  | {
      readonly outcome: "complete";
      readonly durationSeconds: number;
      readonly score: number;
    };

export interface TaskCompletionInput {
  readonly caller: CompletionCaller;
  readonly membership: CompletionMembership;
  readonly task: CompletionTask;
  readonly operation: CompletionOperation;
  /** Identifiant de tâche attendu par la requête validée (jamais du client brut). */
  readonly expectedTaskId: string;
  /** Temps serveur en millisecondes ; jamais une valeur fournie par le client. */
  readonly nowMs: number;
  /** Rôles admis ; par défaut tout membre actif peut terminer sa propre tâche. */
  readonly acceptedRoles?: readonly CompletionRole[];
}

const MAX_TASK_DURATION_SECONDS = 86_400;

function reject(
  code: CompletionRejectionCode,
  message: string,
): TaskCompletionDecision {
  return { outcome: "reject", code, message };
}

function isReadableRole(value: unknown): value is CompletionRole {
  return value === "owner" || value === "admin" || value === "member";
}

/**
 * Un enregistrement d'idempotence rejouable doit reproduire exactement ce que
 * le serveur écrit lui-même : la tâche visée par la requête, une durée entière
 * dans la borne serveur (1 à 86 400 s) et un score strictement positif. Toute
 * autre valeur trahit une corruption et échoue fermé au lieu d'être rejouée.
 */
function isReplayableOperation(
  resourceId: unknown,
  durationSeconds: unknown,
  score: unknown,
  expectedTaskId: string,
): boolean {
  return (
    resourceId === expectedTaskId &&
    typeof durationSeconds === "number" &&
    Number.isInteger(durationSeconds) &&
    durationSeconds >= 1 &&
    durationSeconds <= MAX_TASK_DURATION_SECONDS &&
    typeof score === "number" &&
    Number.isFinite(score) &&
    score > 0
  );
}

/**
 * Décide si la requête `completeTask` peut aboutir, et à quoi :
 * refus motivé, échec fermé, rejeu idempotent ou complétion avec durée et
 * score calculés côté serveur. L'ordre des contrôles préserve la sémantique
 * d'erreur existante : identité, adhésion, idempotence, existence, propriété,
 * état, poids figé, borne de durée.
 */
export function decideTaskCompletion(
  input: TaskCompletionInput,
): TaskCompletionDecision {
  const { caller, membership, task, operation } = input;

  // Enveloppe de la requête serveur elle-même (défensive, jamais du client).
  if (
    !Number.isSafeInteger(input.nowMs) ||
    typeof input.expectedTaskId !== "string" ||
    input.expectedTaskId.length === 0
  ) {
    return { outcome: "fail_closed", reason: "invalid_request_envelope" };
  }

  // 1. Identité : Auth, App Check, email vérifié, uid exploitable.
  if (!caller.authenticated) {
    return reject("unauthenticated", "Authentification requise.");
  }
  if (!caller.appCheckAttested) {
    return reject("failed-precondition", "Attestation App Check requise.");
  }
  if (caller.emailVerified !== true) {
    return reject(
      "failed-precondition",
      "Une adresse email vérifiée est requise.",
    );
  }
  if (typeof caller.uid !== "string" || caller.uid.length === 0) {
    return reject("unauthenticated", "Authentification requise.");
  }

  // 2. Adhésion au foyer ciblé : statut actif et rôle connu puis accepté.
  //    L'autorisation vient des adhésions stockées, jamais d'une valeur client.
  if (!membership.exists || membership.status !== "active" || !isReadableRole(membership.role)) {
    return reject("permission-denied", "Accès au foyer refusé.");
  }
  const acceptedRoles = input.acceptedRoles ?? ALL_COMPLETION_ROLES;
  if (!acceptedRoles.includes(membership.role)) {
    return reject("permission-denied", "Autorisation insuffisante.");
  }

  // 3. Idempotence : une clé déjà consommée rejoue le résultat initial sans
  //    nouvelle écriture ; un enregistrement illisible ou incohérent avec ce
  //    que le serveur écrit échoue fermé.
  if (operation.exists) {
    if (
      !isReplayableOperation(
        operation.resourceId,
        operation.durationSeconds,
        operation.score,
        input.expectedTaskId,
      )
    ) {
      return { outcome: "fail_closed", reason: "invalid_idempotency_record" };
    }
    return {
      outcome: "replay",
      durationSeconds: operation.durationSeconds as number,
      score: operation.score as number,
    };
  }

  // 4. La tâche doit exister dans le foyer ciblé par la requête.
  if (!task.exists) {
    return reject("not-found", "Tâche introuvable.");
  }

  // 5. Propriété : seul le membre qui a démarré la tâche peut la terminer.
  if (task.ownerUid !== caller.uid) {
    return reject("permission-denied", "Cette tâche appartient à un autre membre.");
  }

  // 6. État : une tâche terminée ou avec un début illisible ne se complète pas.
  if (
    task.status !== "in_progress" ||
    typeof task.startTimeMs !== "number" ||
    !Number.isSafeInteger(task.startTimeMs)
  ) {
    return reject("failed-precondition", "Cette tâche ne peut pas être terminée.");
  }

  // 7. Poids figé à la création : illisible ⇒ refus, jamais de coercion.
  if (
    !Number.isInteger(task.effectiveWeight) ||
    (task.effectiveWeight as number) < 1 ||
    (task.effectiveWeight as number) > 1000
  ) {
    return reject(
      "invalid-argument",
      "weight doit être un entier entre 1 et 1000.",
    );
  }

  // 8. Durée mesurée par le temps serveur, bornée à 24 heures.
  const elapsedSeconds = Math.max(
    1,
    Math.floor((input.nowMs - task.startTimeMs) / 1000),
  );
  if (elapsedSeconds > MAX_TASK_DURATION_SECONDS) {
    return reject(
      "failed-precondition",
      "Une tâche ne peut pas dépasser 24 heures. Démarrez une nouvelle tâche.",
    );
  }

  const score = calculateScore(elapsedSeconds, task.effectiveWeight as number);
  return { outcome: "complete", durationSeconds: elapsedSeconds, score };
}
