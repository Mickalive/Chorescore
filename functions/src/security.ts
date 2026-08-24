import { Timestamp, Transaction } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { CallableRequest, HttpsError } from "firebase-functions/v2/https";

import {
  CallerIdentity,
  requireCaller,
} from "./callerIdentity";
import { sha256 } from "./domain";
import { db } from "./firebase";
import { ValidationError } from "./validation";

export {
  CallerIdentity,
  requireCaller,
} from "./callerIdentity";

export type HouseholdRole = "owner" | "admin" | "member";

export interface ActiveMembership {
  readonly role: HouseholdRole;
}

const KNOWN_ROLES = new Set<HouseholdRole>(["owner", "admin", "member"]);

export function requireAdministrativeCaller(request: CallableRequest<unknown>): CallerIdentity {
  const caller = requireCaller(request);
  if (request.auth?.token.admin !== true) {
    throw new HttpsError("permission-denied", "Autorisation insuffisante.");
  }
  return caller;
}

function parseMembership(data: Record<string, unknown> | undefined): ActiveMembership {
  if (data?.status !== "active" || !KNOWN_ROLES.has(data.role as HouseholdRole)) {
    throw new HttpsError("permission-denied", "Accès au foyer refusé.");
  }
  return { role: data.role as HouseholdRole };
}

export async function requireActiveMembership(
  uid: string,
  householdId: string,
  acceptedRoles: readonly HouseholdRole[] = ["owner", "admin", "member"],
): Promise<ActiveMembership> {
  const snapshot = await db.doc(`households/${householdId}/members/${uid}`).get();
  const membership = parseMembership(snapshot.data());
  if (!acceptedRoles.includes(membership.role)) {
    throw new HttpsError("permission-denied", "Autorisation insuffisante.");
  }
  return membership;
}

export async function requireActiveMembershipInTransaction(
  transaction: Transaction,
  uid: string,
  householdId: string,
  acceptedRoles: readonly HouseholdRole[] = ["owner", "admin", "member"],
): Promise<ActiveMembership> {
  const reference = db.doc(`households/${householdId}/members/${uid}`);
  const snapshot = await transaction.get(reference);
  const membership = parseMembership(snapshot.data());
  if (!acceptedRoles.includes(membership.role)) {
    throw new HttpsError("permission-denied", "Autorisation insuffisante.");
  }
  return membership;
}

export async function enforceRateLimit(
  uid: string,
  action: string,
  maximumRequests: number,
  windowSeconds: number,
): Promise<void> {
  const nowMs = Date.now();
  const reference = db.doc(`rateLimits/${sha256(`${action}:${uid}`)}`);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const data = snapshot.data();
    const windowEndsAt = data?.windowEndsAt;
    const existingEndMs =
      windowEndsAt instanceof Timestamp ? windowEndsAt.toMillis() : 0;
    const existingCount = typeof data?.count === "number" ? data.count : 0;

    if (existingEndMs > nowMs && existingCount >= maximumRequests) {
      throw new HttpsError(
        "resource-exhausted",
        "Trop de tentatives. Réessayez plus tard.",
      );
    }

    if (existingEndMs > nowMs) {
      transaction.update(reference, {
        count: existingCount + 1,
        updatedAt: Timestamp.fromMillis(nowMs),
      });
      return;
    }

    transaction.set(reference, {
      action,
      count: 1,
      windowEndsAt: Timestamp.fromMillis(nowMs + windowSeconds * 1000),
      updatedAt: Timestamp.fromMillis(nowMs),
    });
  });
}

export function operationDocumentId(uid: string, action: string, key: string): string {
  return sha256(`${uid}:${action}:${key}`);
}

export function handleCallableError(error: unknown, operation: string): never {
  if (error instanceof HttpsError) {
    throw error;
  }
  if (error instanceof ValidationError) {
    throw new HttpsError("invalid-argument", error.message);
  }
  logger.error("Callable operation failed", {
    operation,
    errorType: error instanceof Error ? error.name : "UnknownError",
  });
  throw new HttpsError("internal", "L'opération n'a pas pu être exécutée.");
}
