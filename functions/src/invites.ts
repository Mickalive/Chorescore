import { Timestamp, Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { APP_BASE_URL, FUNCTION_REGION, requireHttpsBaseUrl } from "./config";
import { createOpaqueInviteToken } from "./domain";
import { db } from "./firebase";
import {
  decideInviteCreation,
  decideInviteRedemption,
  decideInviteRedemptionCapacity,
  inviteDigest,
  InviteCapacity,
  InviteRejectionDecision,
} from "./invitations";
import { observedCaller } from "./observedCaller";
import { resolveHouseholdPlanInTransaction } from "./plans";
import {
  enforceRateLimit,
  handleCallableError,
  requireActiveMembershipInTransaction,
  requireCaller,
} from "./security";
import { firestoreId, integer, inviteToken, strictRecord } from "./validation";

function memberCount(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 100) {
    throw new HttpsError("internal", "Composition du foyer invalide.");
  }
  return value as number;
}

function memberCountOrNull(value: unknown): number | null {
  try {
    return memberCount(value);
  } catch {
    return null;
  }
}

function invitationUnavailable(): HttpsError {
  return new HttpsError(
    "permission-denied",
    "Cette invitation est invalide ou indisponible.",
  );
}

/**
 * Mappe une décision de refus ou d'échec fermé sur les erreurs appelables
 * historiques : codes et messages identiques un à un à l'implémentation
 * précédente, afin que les clients et les journaux ne voient aucune dérive.
 */
function throwInviteDecisionError(decision: InviteRejectionDecision): never {
  if (decision.outcome === "reject") {
    throw new HttpsError(decision.code, decision.message);
  }
  switch (decision.reason) {
    case "invalid_request_envelope":
      throw new Error("INVALID_INVITE_ENVELOPE");
    case "invalid_household_state":
      throw new HttpsError("internal", "Composition du foyer invalide.");
    case "invalid_invite_record":
      throw new HttpsError(
        "invalid-argument",
        "householdId n'est pas un identifiant valide.",
      );
    case "billing_unavailable":
      throw new HttpsError("internal", "État d'abonnement indisponible.");
  }
}

interface HouseholdCapacitySnapshot {
  readonly capacity: InviteCapacity;
  /** Composition validée ; nulle si illisible (la décision échouera fermé). */
  readonly memberCount: number | null;
  /**
   * Erreur métier d'origine capturée lors de la résolution de facturation ;
   * relancée telle quelle au stade capacité afin de préserver le message
   * interne exact (« État d'essai indisponible. » ou « État d'abonnement
   * indisponible. ») au lieu d'une confusion.
   */
  readonly billingError: unknown;
}

/**
 * Résout la capacité d'accueil du foyer en convertissant les indécisions en
 * données : composition illisible ou état de facturation indisponible ne
 * lancent plus ici, ils sont examinés par la décision au moment où elle en a
 * besoin, après les portes d'autorisation et de validité. Les erreurs non
 * métier conservent leur diagnostic générique.
 */
async function loadInviteCapacity(
  transaction: Transaction,
  householdId: string,
  rawMemberCount: unknown,
  nowMs: number,
): Promise<HouseholdCapacitySnapshot> {
  const count = memberCountOrNull(rawMemberCount);
  if (count === null) {
    return {
      capacity: { status: "invalid_household_state" },
      memberCount: null,
      billingError: null,
    };
  }
  try {
    const resolution = await resolveHouseholdPlanInTransaction(
      transaction,
      householdId,
      count,
      nowMs,
    );
    return {
      capacity: {
        status: "available",
        memberLimit: resolution.memberLimit,
        standardMemberLimitExceeded: resolution.standardMemberLimitExceeded,
      },
      memberCount: count,
      billingError: null,
    };
  } catch (error) {
    if (error instanceof HttpsError) {
      return {
        capacity: { status: "billing_unavailable" },
        memberCount: count,
        billingError: error,
      };
    }
    throw error;
  }
}

/**
 * Relance l'erreur de facturation d'origine si la décision a échoué fermé
 * pour cette raison, sinon applique le mapping historique des décisions.
 */
function throwInviteDecisionOrBillingError(
  loaded: HouseholdCapacitySnapshot,
  decision: InviteRejectionDecision,
): never {
  if (
    decision.outcome === "fail_closed" &&
    decision.reason === "billing_unavailable" &&
    loaded.billingError !== null
  ) {
    throw loaded.billingError;
  }
  throwInviteDecisionError(decision);
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

      // Le jeton brut n'existe que dans la réponse : seul son condensat
      // désigne le document stocké.
      const rawToken = createOpaqueInviteToken();
      const tokenHash = inviteDigest(rawToken);
      const inviteReference = db.doc(`invites/${tokenHash}`);
      const householdReference = db.doc(`households/${householdId}`);
      const now = Timestamp.now();

      const response = await db.runTransaction(async (transaction) => {
        const householdSnapshot = await transaction.get(householdReference);
        // L'adhésion administrative est exigée ici exactement comme avant.
        // Les portes d'identité de la décision sont alimentées par les valeurs
        // réellement observées sur la requête (constat F1) : elles restent
        // exécutables si une garde amont venait à s'affaiblir. Les portes
        // d'adhésion restent adossées à requireActiveMembershipInTransaction,
        // qui n'expose pas l'instantané brut ; tout affaiblissement futur de
        // cette garde exige donc toujours une revue croisée avec ce fichier.
        const activeMembership = await requireActiveMembershipInTransaction(
          transaction,
          caller.uid,
          householdId,
          ["owner", "admin"],
        );
        const capacityLoad = await loadInviteCapacity(
          transaction,
          householdId,
          householdSnapshot.data()?.memberCount,
          now.toMillis(),
        );

        // Décision d'autorisation en logique pure : identité observée sur la
        // requête brute via observedCaller(request) — câblage épinglé par
        // test/observedCallerWiring.test.ts, un retour aux constantes y est
        // détecté —, adhésion, rôle, existence du foyer, capacité du plan,
        // expiration depuis le temps serveur.
        const decision = decideInviteCreation({
          caller: observedCaller(request),
          membership: {
            exists: true,
            status: "active",
            role: activeMembership.role,
          },
          household: {
            exists: householdSnapshot.exists,
            memberCount: householdSnapshot.data()?.memberCount,
          },
          capacity: capacityLoad.capacity,
          expectedHouseholdId: householdId,
          expiresInHours,
          nowMs: now.toMillis(),
        });

        if (decision.outcome !== "accept") {
          throwInviteDecisionOrBillingError(capacityLoad, decision);
        }

        transaction.create(inviteReference, {
          householdId,
          createdBy: caller.uid,
          status: "active",
          maxUses: 1,
          useCount: 0,
          redeemedBy: null,
          createdAt: now,
          expiresAt: Timestamp.fromMillis(decision.expiresAtMs),
          revokedAt: null,
        });

        return {
          inviteUrl: `${appBaseUrl}/invite#token=${encodeURIComponent(rawToken)}`,
          expiresAt: Timestamp.fromMillis(decision.expiresAtMs).toDate().toISOString(),
        };
      });

      return response;
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
      const tokenHash = inviteDigest(rawToken);

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
        // Portes d'enveloppe historiques conservées à l'identique : un
        // identifiant stocké malformé produit exactement les erreurs fines
        // d'origine. La décision revalide ces valeurs en défense profonde et
        // ses branches correspondantes restent exercées par les tests.
        const targetHouseholdId = firestoreId(
          { householdId: householdIdValue },
          "householdId",
        );

        const householdReference = db.doc(`households/${targetHouseholdId}`);
        const householdSnapshot = await transaction.get(householdReference);
        const memberSnapshot = await transaction.get(
          householdReference.collection("members").doc(caller.uid),
        );
        const memberStatus = memberSnapshot.data()?.status;

        // Première phase de la décision en logique pure : identité observée
        // sur la requête brute (même épinglage que createInvite), forme du
        // jeton, invitation stockée, foyer désigné par le document, rejeu de
        // double acceptation, expiration serveur. La capacité n'est chargée
        // qu'après ces portes, préservant l'ordre historique des lectures et
        // des refus.
        const preDecision = decideInviteRedemption({
          caller: observedCaller(request),
          invite: {
            exists: inviteSnapshot.exists,
            householdId: targetHouseholdId,
            status: inviteData?.status,
            useCount: inviteData?.useCount,
            redeemedBy: inviteData?.redeemedBy,
            expiresAtMs:
              inviteData?.expiresAt instanceof Timestamp
                ? inviteData.expiresAt.toMillis()
                : null,
            revokedAt: inviteData?.revokedAt,
          },
          householdExists: householdSnapshot.exists,
          membershipStatus: memberStatus,
          rawToken,
          nowMs: now.toMillis(),
        });

        if (preDecision.outcome === "replay") {
          return {
            householdId: preDecision.householdId,
            alreadyMember: true as const,
          };
        }
        if (preDecision.outcome !== "evaluate_capacity") {
          throwInviteDecisionError(preDecision);
        }

        // Seconde phase : capacité du foyer désigné puis rattachement.
        const capacityLoad = await loadInviteCapacity(
          transaction,
          targetHouseholdId,
          householdSnapshot.data()?.memberCount,
          now.toMillis(),
        );
        const decision = decideInviteRedemptionCapacity({
          householdId: preDecision.householdId,
          capacity: capacityLoad.capacity,
          householdMemberCount: householdSnapshot.data()?.memberCount,
          alreadyActiveMember: memberStatus === "active",
        });
        if (decision.outcome !== "accept") {
          throwInviteDecisionOrBillingError(capacityLoad, decision);
        }

        const householdId = decision.householdId;
        const isAlreadyActiveMember = memberStatus === "active";
        transaction.update(inviteReference, {
          status: "redeemed",
          useCount: 1,
          redeemedBy: caller.uid,
          redeemedAt: now,
        });
        if (!isAlreadyActiveMember) {
          if (capacityLoad.memberCount === null) {
            // Inatteignable : la décision n'accepte qu'avec une composition
            // de foyer validée.
            throw new Error("INVALID_INVITE_STATE");
          }
          const memberReference = db.doc(
            `households/${householdId}/members/${caller.uid}`,
          );
          const userMembershipReference = db.doc(
            `users/${caller.uid}/memberships/${householdId}`,
          );
          transaction.set(memberReference, {
            role: decision.assignedRole,
            status: "active",
            displayName: caller.displayName,
            joinedAt: now,
            updatedAt: now,
          });
          transaction.set(userMembershipReference, {
            householdId,
            role: decision.assignedRole,
            status: "active",
            householdName: householdSnapshot.data()?.name,
            joinedAt: now,
            updatedAt: now,
          });
          transaction.update(householdReference, {
            memberCount: capacityLoad.memberCount + 1,
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
