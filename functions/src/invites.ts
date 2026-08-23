import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { APP_BASE_URL, FUNCTION_REGION } from "./config";
import { createOpaqueInviteToken, sha256 } from "./domain";
import { db } from "./firebase";
import { resolveHouseholdPlanInTransaction } from "./plans";
import {
  enforceRateLimit,
  handleCallableError,
  requireActiveMembershipInTransaction,
  requireCaller,
} from "./security";
import {
  firestoreId,
  integer,
  inviteToken,
  strictRecord,
} from "./validation";
import { requireHttpsBaseUrl } from "./config";

function memberCount(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 100) {
    throw new HttpsError("internal", "Composition du foyer invalide.");
  }
  return value as number;
}

function invitationUnavailable(): HttpsError {
  return new HttpsError(
    "permission-denied",
    "Cette invitation est invalide ou indisponible.",
  );
}

export const createInvite = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    timeoutSeconds: 30,
    maxInstances: 30,
  },
  async (request) => {
    try {
      const caller = requireCaller(request);
      const input = strictRecord(request.data, ["householdId", "expiresInHours"]);
      const householdId = firestoreId(input, "householdId");
      const expiresInHours = integer(input, "expiresInHours", 1, 72, 24);
      const appBaseUrl = requireHttpsBaseUrl(APP_BASE_URL.value());

      await enforceRateLimit(caller.uid, "createInvite", 20, 3600);

      const rawToken = createOpaqueInviteToken();
      const tokenHash = sha256(rawToken);
      const inviteReference = db.doc(`invites/${tokenHash}`);
      const householdReference = db.doc(`households/${householdId}`);
      const now = Timestamp.now();
      const expiresAt = Timestamp.fromMillis(
        now.toMillis() + expiresInHours * 3_600_000,
      );

      await db.runTransaction(async (transaction) => {
        const householdSnapshot = await transaction.get(householdReference);
        await requireActiveMembershipInTransaction(
          transaction,
          caller.uid,
          householdId,
          ["owner", "admin"],
        );
        if (!householdSnapshot.exists) {
          throw new HttpsError("not-found", "Foyer introuvable.");
        }
        const currentMemberCount = memberCount(householdSnapshot.data()?.memberCount);
        const resolution = await resolveHouseholdPlanInTransaction(
          transaction,
          householdId,
          currentMemberCount,
          now.toMillis(),
        );
        if (
          resolution.standardMemberLimitExceeded ||
          currentMemberCount >= resolution.memberLimit
        ) {
          throw new HttpsError(
            "failed-precondition",
            "Ce foyer doit utiliser le plan Pro avant d'inviter un membre supplémentaire.",
          );
        }

        transaction.create(inviteReference, {
          householdId,
          createdBy: caller.uid,
          status: "active",
          maxUses: 1,
          useCount: 0,
          redeemedBy: null,
          createdAt: now,
          expiresAt,
          revokedAt: null,
        });
      });

      return {
        inviteUrl: `${appBaseUrl}/invite#token=${encodeURIComponent(rawToken)}`,
        expiresAt: expiresAt.toDate().toISOString(),
      };
    } catch (error) {
      return handleCallableError(error, "createInvite");
    }
  },
);

export const redeemInvite = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    timeoutSeconds: 30,
    maxInstances: 40,
  },
  async (request) => {
    try {
      const caller = requireCaller(request);
      const input = strictRecord(request.data, ["token"]);
      const rawToken = inviteToken(input, "token");
      const tokenHash = sha256(rawToken);

      await enforceRateLimit(caller.uid, "redeemInvite", 20, 3600);

      const inviteReference = db.doc(`invites/${tokenHash}`);
      const now = Timestamp.now();

      const result = await db.runTransaction(async (transaction) => {
        const inviteSnapshot = await transaction.get(inviteReference);
        if (!inviteSnapshot.exists) {
          throw invitationUnavailable();
        }
        const inviteData = inviteSnapshot.data();
        if (inviteData === undefined) {
          throw invitationUnavailable();
        }
        const householdIdValue = inviteData?.householdId;
        if (typeof householdIdValue !== "string") {
          throw invitationUnavailable();
        }
        const householdId = firestoreId({ householdId: householdIdValue }, "householdId");
        const householdReference = db.doc(`households/${householdId}`);
        const memberReference = householdReference.collection("members").doc(caller.uid);
        const userMembershipReference = db.doc(
          `users/${caller.uid}/memberships/${householdId}`,
        );
        const householdSnapshot = await transaction.get(householdReference);
        const memberSnapshot = await transaction.get(memberReference);
        if (!householdSnapshot.exists) {
          throw invitationUnavailable();
        }

        if (inviteData.redeemedBy === caller.uid && memberSnapshot.data()?.status === "active") {
          return { householdId, alreadyMember: true };
        }
        if (
          inviteData.status !== "active" ||
          inviteData.useCount !== 0 ||
          !(inviteData.expiresAt instanceof Timestamp) ||
          inviteData.expiresAt.toMillis() <= now.toMillis() ||
          inviteData.revokedAt !== null
        ) {
          throw invitationUnavailable();
        }

        const householdData = householdSnapshot.data();
        const currentMemberCount = memberCount(householdData?.memberCount);
        const resolution = await resolveHouseholdPlanInTransaction(
          transaction,
          householdId,
          currentMemberCount,
          now.toMillis(),
        );
        const isAlreadyActiveMember = memberSnapshot.data()?.status === "active";
        if (
          !isAlreadyActiveMember &&
          (resolution.standardMemberLimitExceeded ||
            currentMemberCount >= resolution.memberLimit)
        ) {
          throw new HttpsError(
            "failed-precondition",
            "Ce foyer doit utiliser le plan Pro avant d'ajouter un membre.",
          );
        }

        transaction.update(inviteReference, {
          status: "redeemed",
          useCount: 1,
          redeemedBy: caller.uid,
          redeemedAt: now,
        });
        if (!isAlreadyActiveMember) {
          transaction.set(memberReference, {
            role: "member",
            status: "active",
            displayName: caller.displayName,
            joinedAt: now,
            updatedAt: now,
          });
          transaction.set(userMembershipReference, {
            householdId,
            role: "member",
            status: "active",
            householdName: householdData?.name,
            joinedAt: now,
            updatedAt: now,
          });
          transaction.update(householdReference, {
            memberCount: currentMemberCount + 1,
            updatedAt: now,
          });
        }

        return { householdId, alreadyMember: isAlreadyActiveMember };
      });

      return result;
    } catch (error) {
      return handleCallableError(error, "redeemInvite");
    }
  },
);
