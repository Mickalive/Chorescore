import { Timestamp } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";

import { FUNCTION_REGION, TRIAL_DAYS } from "./config";
import { db } from "./firebase";
import {
  enforceRateLimit,
  handleCallableError,
  operationDocumentId,
  requireCaller,
} from "./security";
import { firestoreId, requiredString, strictRecord, timeZone, uuidV4 } from "./validation";

const DEFAULT_TASK_TEMPLATES = [
  { name: "Vaisselle", category: "dishes" },
  { name: "Préparer un repas", category: "cooking" },
  { name: "Nettoyage", category: "cleaning" },
  { name: "Lessive", category: "laundry" },
  { name: "Courses", category: "shopping" },
] as const;

export const createHousehold = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    timeoutSeconds: 30,
    maxInstances: 20,
  },
  async (request) => {
    try {
      const caller = requireCaller(request);
      const input = strictRecord(request.data, ["name", "timezone", "idempotencyKey"]);
      const name = requiredString(input, "name", 1, 80);
      const householdTimeZone = timeZone(input, "timezone");
      const idempotencyKey = uuidV4(input, "idempotencyKey");

      await enforceRateLimit(caller.uid, "createHousehold", 5, 86_400);

      const operationId = operationDocumentId(
        caller.uid,
        "createHousehold",
        idempotencyKey,
      );
      const operationReference = db.doc(`operationKeys/${operationId}`);
      const householdReference = db.collection("households").doc();
      const billingReference = db.doc(`billingHouseholds/${householdReference.id}`);
      const membershipReference = householdReference.collection("members").doc(caller.uid);
      const userMembershipReference = db.doc(
        `users/${caller.uid}/memberships/${householdReference.id}`,
      );
      const now = Timestamp.now();
      const trialEndsAt = Timestamp.fromMillis(
        now.toMillis() + TRIAL_DAYS * 86_400_000,
      );

      const result = await db.runTransaction(async (transaction) => {
        const operationSnapshot = await transaction.get(operationReference);
        if (operationSnapshot.exists) {
          const existingHouseholdId = operationSnapshot.data()?.resourceId;
          if (typeof existingHouseholdId !== "string") {
            throw new Error("INVALID_IDEMPOTENCY_RECORD");
          }
          const existingTrialEndsAt = operationSnapshot.data()?.trialEndsAt;
          if (!(existingTrialEndsAt instanceof Timestamp)) {
            throw new Error("INVALID_IDEMPOTENCY_RECORD");
          }
          return {
            householdId: firestoreId({ householdId: existingHouseholdId }, "householdId"),
            plan: "trial" as const,
            trialEndsAt: existingTrialEndsAt.toDate().toISOString(),
          };
        }

        transaction.create(householdReference, {
          name,
          timezone: householdTimeZone,
          createdBy: caller.uid,
          memberCount: 1,
          createdAt: now,
          updatedAt: now,
          entitlementSnapshot: {
            plan: "trial",
            validUntil: trialEndsAt,
            requiresPro: false,
          },
        });
        transaction.create(billingReference, {
          paidTier: null,
          stripeStatus: "none",
          stripeCurrentPeriodEnd: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          trialEndsAt,
          createdAt: now,
          updatedAt: now,
        });
        transaction.create(membershipReference, {
          role: "owner",
          status: "active",
          displayName: caller.displayName,
          joinedAt: now,
          updatedAt: now,
        });
        transaction.create(userMembershipReference, {
          householdId: householdReference.id,
          role: "owner",
          status: "active",
          householdName: name,
          joinedAt: now,
          updatedAt: now,
        });

        for (const template of DEFAULT_TASK_TEMPLATES) {
          const templateReference = householdReference.collection("taskTemplates").doc();
          transaction.create(templateReference, {
            name: template.name,
            category: template.category,
            configuredWeight: 1,
            archived: false,
            createdBy: caller.uid,
            createdAt: now,
            updatedAt: now,
          });
        }

        transaction.create(operationReference, {
          uid: caller.uid,
          action: "createHousehold",
          resourceId: householdReference.id,
          trialEndsAt,
          createdAt: now,
          expiresAt: Timestamp.fromMillis(now.toMillis() + 7 * 86_400_000),
        });
        return {
          householdId: householdReference.id,
          plan: "trial" as const,
          trialEndsAt: trialEndsAt.toDate().toISOString(),
        };
      });

      return result;
    } catch (error) {
      return handleCallableError(error, "createHousehold");
    }
  },
);
