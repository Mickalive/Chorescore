import { DocumentData, Timestamp, Transaction } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import {
  BillingState,
  EffectivePlan,
  PaidTier,
  PlanResolution,
  resolvePlan,
  StripeSubscriptionStatus,
} from "./domain";
import { db } from "./firebase";

const STRIPE_STATUSES = new Set<StripeSubscriptionStatus>([
  "active",
  "trialing",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
  "none",
]);

function timestampMillis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}

export function billingStateFromDocument(data: DocumentData | undefined): BillingState {
  if (data === undefined) {
    throw new HttpsError("internal", "État d'abonnement indisponible.");
  }

  const paidTier: PaidTier | null =
    data.paidTier === "standard" || data.paidTier === "pro"
      ? data.paidTier
      : null;
  const stripeStatus = STRIPE_STATUSES.has(data.stripeStatus as StripeSubscriptionStatus)
    ? (data.stripeStatus as StripeSubscriptionStatus)
    : "none";
  const trialEndsAtMs = timestampMillis(data.trialEndsAt);
  if (trialEndsAtMs === null) {
    throw new HttpsError("internal", "État d'essai indisponible.");
  }

  return {
    paidTier,
    stripeStatus,
    stripeCurrentPeriodEndMs: timestampMillis(data.stripeCurrentPeriodEnd),
    trialEndsAtMs,
  };
}

export async function resolveHouseholdPlanInTransaction(
  transaction: Transaction,
  householdId: string,
  memberCount: number,
  nowMs: number,
): Promise<PlanResolution> {
  const billingReference = db.doc(`billingHouseholds/${householdId}`);
  const billingSnapshot = await transaction.get(billingReference);
  return resolvePlan(
    billingStateFromDocument(billingSnapshot.data()),
    nowMs,
    memberCount,
  );
}

export function publicPlanSnapshot(
  plan: EffectivePlan,
  validUntilMs: number | null,
  requiresPro: boolean,
): Record<string, unknown> {
  return {
    plan,
    validUntil: validUntilMs === null ? null : Timestamp.fromMillis(validUntilMs),
    requiresPro,
  };
}
