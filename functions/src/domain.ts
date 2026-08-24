import { createHash, randomBytes } from "node:crypto";

import {
  MAX_PRO_MEMBERS,
  MAX_STANDARD_MEMBERS,
  MIN_ANALYTICS_COHORT,
} from "./constants";

export const PAID_TIERS = ["standard", "pro"] as const;
export type PaidTier = (typeof PAID_TIERS)[number];
export type EffectivePlan = "trial" | "free" | PaidTier;
export type StripeSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
  | "none";

/**
 * Seules valeurs que le système écrit jamais dans un champ `stripeStatus`
 * stocké : les statuts d'abonnement Stripe connus ou « none ». Une autre
 * valeur lue depuis Firestore trahit une corruption et doit échouer fermé
 * (voir `storedBillingStateIsUnreadable`) plutôt que d'être coercée.
 */
export const ALL_STRIPE_STATUSES: readonly StripeSubscriptionStatus[] = [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
  "none",
];

export const TASK_CATEGORIES = [
  "dishes",
  "cooking",
  "cleaning",
  "laundry",
  "shopping",
  "other",
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export interface BillingState {
  readonly paidTier: PaidTier | null;
  readonly stripeStatus: StripeSubscriptionStatus;
  readonly stripeCurrentPeriodEndMs: number | null;
  readonly trialEndsAtMs: number;
}

export interface PlanResolution {
  readonly plan: EffectivePlan;
  readonly memberLimit: number;
  readonly standardMemberLimitExceeded: boolean;
}

const ACTIVE_STRIPE_STATUSES = new Set<StripeSubscriptionStatus>([
  "active",
  "trialing",
]);

export function resolvePlan(
  billing: BillingState,
  nowMs: number,
  memberCount: number,
): PlanResolution {
  const paidAccessIsCurrent =
    billing.paidTier !== null &&
    ACTIVE_STRIPE_STATUSES.has(billing.stripeStatus) &&
    billing.stripeCurrentPeriodEndMs !== null &&
    billing.stripeCurrentPeriodEndMs > nowMs;

  if (paidAccessIsCurrent && billing.paidTier === "pro") {
    return {
      plan: "pro",
      memberLimit: MAX_PRO_MEMBERS,
      standardMemberLimitExceeded: false,
    };
  }

  if (paidAccessIsCurrent && billing.paidTier === "standard") {
    return {
      plan: "standard",
      memberLimit: MAX_STANDARD_MEMBERS,
      standardMemberLimitExceeded: memberCount > MAX_STANDARD_MEMBERS,
    };
  }

  if (billing.trialEndsAtMs > nowMs) {
    return {
      plan: "trial",
      memberLimit: MAX_PRO_MEMBERS,
      standardMemberLimitExceeded: false,
    };
  }

  return {
    plan: "free",
    memberLimit: MAX_PRO_MEMBERS,
    standardMemberLimitExceeded: false,
  };
}

export function getEffectiveWeight(
  plan: EffectivePlan,
  configuredWeight: number,
): number {
  if (!Number.isInteger(configuredWeight) || configuredWeight < 1 || configuredWeight > 1000) {
    throw new Error("INVALID_WEIGHT");
  }
  return plan === "free" ? 1 : configuredWeight;
}

export type SubscriptionEventRejectionReason =
  | "stale_event_ordering"
  | "superseded_subscription_terminal"
  | "superseded_subscription_live";

export type SubscriptionEventDecision =
  | { readonly action: "apply" }
  | {
      readonly action: "ignore";
      readonly reason: SubscriptionEventRejectionReason;
    };

export interface IncomingSubscriptionEventOrdering {
  readonly eventCreatedSeconds: number;
  readonly subscriptionId: string;
  readonly stripeStatus: StripeSubscriptionStatus;
  readonly tier: PaidTier | null;
}

export interface StoredSubscriptionOrdering {
  readonly stripeSubscriptionId: string | null;
  readonly lastStripeEventCreatedSeconds: number | null;
  readonly stripeStatus: StripeSubscriptionStatus;
  readonly stripeCurrentPeriodEndMs: number | null;
  readonly tier: PaidTier | null;
}

const TIER_RANK: Record<PaidTier, number> = { standard: 0, pro: 1 };

/**
 * Décide si un événement d'abonnement Stripe peut mettre à jour l'état de
 * facturation d'un foyer. Garantie visée : un événement ancien ne remplace
 * jamais un état plus récent.
 *
 * - Un événement strictement plus ancien que le dernier appliqué est ignoré ;
 *   l'égalité de seconde reste admise car plusieurs événements légitimes
 *   partagent la même seconde et le contenu est revalidé auprès de Stripe.
 * - Un événement non vivant (résiliation, impayé définitif…) portant sur un
 *   abonnement différent de celui suivi est ignoré : la résiliation d'un
 *   ancien abonnement ne doit pas effacer le droit d'un abonnement plus récent.
 * - Entre deux abonnements vivants différents, la bascule n'est admise que si
 *   elle ne rétrograde pas le niveau connu : le renouvellement tardif d'un
 *   ancien abonnement ne doit pas réduire silencieusement un droit supérieur.
 *   Un rang inconnu est refusé tant que l'abonnement suivi est vivant.
 * - Un abonnement vivant différent prend le relais dès que l'accès suivi n'est
 *   plus courant (reprise après expiration).
 * - À défaut d'abonnement suivi, l'événement s'applique ; il ne peut alors que
 *   retirer un accès, jamais en accorder un faux.
 */
export function decideSubscriptionEventApplication(
  incoming: IncomingSubscriptionEventOrdering,
  stored: StoredSubscriptionOrdering,
  nowMs: number,
): SubscriptionEventDecision {
  if (
    stored.lastStripeEventCreatedSeconds !== null &&
    incoming.eventCreatedSeconds < stored.lastStripeEventCreatedSeconds
  ) {
    return { action: "ignore", reason: "stale_event_ordering" };
  }

  const tracksDifferentSubscription =
    stored.stripeSubscriptionId !== null &&
    stored.stripeSubscriptionId !== incoming.subscriptionId;
  if (!tracksDifferentSubscription) {
    return { action: "apply" };
  }

  if (!ACTIVE_STRIPE_STATUSES.has(incoming.stripeStatus)) {
    return { action: "ignore", reason: "superseded_subscription_terminal" };
  }

  const storedAccessIsCurrent =
    ACTIVE_STRIPE_STATUSES.has(stored.stripeStatus) &&
    stored.stripeCurrentPeriodEndMs !== null &&
    stored.stripeCurrentPeriodEndMs > nowMs;

  if (
    storedAccessIsCurrent &&
    (incoming.tier === null ||
      stored.tier === null ||
      TIER_RANK[incoming.tier] < TIER_RANK[stored.tier])
  ) {
    return { action: "ignore", reason: "superseded_subscription_live" };
  }

  return { action: "apply" };
}

export function calculateScore(durationSeconds: number, weightSnapshot: number): number {
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 86_400) {
    throw new Error("INVALID_DURATION");
  }
  if (!Number.isInteger(weightSnapshot) || weightSnapshot < 1 || weightSnapshot > 1000) {
    throw new Error("INVALID_WEIGHT");
  }
  return (durationSeconds / 60) * weightSnapshot;
}

export function createOpaqueInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function isoWeekKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = new Map(parts.map((part) => [part.type, part.value]));
  const year = Number(values.get("year"));
  const month = Number(values.get("month"));
  const day = Number(values.get("day"));
  const localDateAsUtc = new Date(Date.UTC(year, month - 1, day));
  const weekDay = localDateAsUtc.getUTCDay() || 7;
  localDateAsUtc.setUTCDate(localDateAsUtc.getUTCDate() + 4 - weekDay);
  const isoYear = localDateAsUtc.getUTCFullYear();
  const firstDay = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(
    ((localDateAsUtc.getTime() - firstDay.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

export interface AnalyticsEvent {
  readonly householdBucketId: string;
  readonly category: TaskCategory;
  readonly durationBucketMinutes: number;
}

export interface AnalyticsCategoryAggregate {
  readonly completedTasks: number;
  readonly contributingHouseholds: number;
  readonly averageDurationBucketMinutes: number;
}

export interface AnalyticsAggregate {
  readonly contributingHouseholds: number;
  readonly categories: Partial<Record<TaskCategory, AnalyticsCategoryAggregate>>;
}

export function aggregateAnalyticsEvents(events: readonly AnalyticsEvent[]): AnalyticsAggregate {
  const allHouseholds = new Set(events.map((event) => event.householdBucketId));
  if (allHouseholds.size < MIN_ANALYTICS_COHORT) {
    throw new Error("COHORT_TOO_SMALL");
  }

  const categories: Partial<Record<TaskCategory, AnalyticsCategoryAggregate>> = {};
  for (const category of TASK_CATEGORIES) {
    const categoryEvents = events.filter((event) => event.category === category);
    const households = new Set(categoryEvents.map((event) => event.householdBucketId));
    if (households.size < MIN_ANALYTICS_COHORT) {
      continue;
    }
    const durationTotal = categoryEvents.reduce(
      (sum, event) => sum + event.durationBucketMinutes,
      0,
    );
    categories[category] = {
      completedTasks: categoryEvents.length,
      contributingHouseholds: households.size,
      averageDurationBucketMinutes:
        Math.round((durationTotal / categoryEvents.length) * 100) / 100,
    };
  }

  return {
    contributingHouseholds: allHouseholds.size,
    categories,
  };
}
