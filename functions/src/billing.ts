import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import Stripe from "stripe";

import {
  APP_BASE_URL,
  FUNCTION_REGION,
  MAX_STANDARD_MEMBERS,
  STRIPE_ENABLED,
  STRIPE_LIVE_MODE,
  STRIPE_PRO_PRICE_ID,
  STRIPE_SECRET_KEY,
  STRIPE_STANDARD_PRICE_ID,
  STRIPE_WEBHOOK_SECRET,
  requireConfiguredValue,
  requireHttpsBaseUrl,
} from "./config";
import {
  decideSubscriptionEventOrder,
  storedBillingStateIsUnreadable,
} from "./billingOrder";
import {
  PaidTier,
  decideSubscriptionEventApplication,
  resolvePlan,
  StripeSubscriptionStatus,
} from "./domain";
import { db } from "./firebase";
import { billingStateFromDocument, publicPlanSnapshot } from "./plans";
import {
  enforceRateLimit,
  handleCallableError,
  operationDocumentId,
  requireActiveMembership,
  requireCaller,
} from "./security";
import { firestoreId, paidTier, strictRecord, uuidV4 } from "./validation";

const HANDLED_SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

function stripeClient(): Stripe {
  return new Stripe(requireConfiguredValue("STRIPE_SECRET_KEY", STRIPE_SECRET_KEY.value()));
}

function requireStripeEnabled(): void {
  if (!STRIPE_ENABLED.value()) {
    throw new HttpsError(
      "failed-precondition",
      "Stripe est désactivé. Activez-le explicitement après configuration des secrets.",
    );
  }
}

function requireMemberCount(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 100) {
    throw new HttpsError("internal", "Composition du foyer invalide.");
  }
  return value as number;
}

function priceForTier(tier: PaidTier): string {
  return tier === "standard"
    ? requireConfiguredValue("STRIPE_STANDARD_PRICE_ID", STRIPE_STANDARD_PRICE_ID.value())
    : requireConfiguredValue("STRIPE_PRO_PRICE_ID", STRIPE_PRO_PRICE_ID.value());
}

export const createCheckoutSession = onCall(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    timeoutSeconds: 30,
    maxInstances: 20,
    secrets: [STRIPE_SECRET_KEY],
  },
  async (request) => {
    try {
      requireStripeEnabled();
      const caller = requireCaller(request);
      const input = strictRecord(request.data, [
        "householdId",
        "tier",
        "idempotencyKey",
      ]);
      const householdId = firestoreId(input, "householdId");
      const tier = paidTier(input, "tier");
      const idempotencyKey = uuidV4(input, "idempotencyKey");

      await enforceRateLimit(caller.uid, "createCheckoutSession", 5, 600);
      await requireActiveMembership(caller.uid, householdId, ["owner"]);

      const [householdSnapshot, billingSnapshot] = await Promise.all([
        db.doc(`households/${householdId}`).get(),
        db.doc(`billingHouseholds/${householdId}`).get(),
      ]);
      if (!householdSnapshot.exists || !billingSnapshot.exists) {
        throw new HttpsError("not-found", "Foyer introuvable.");
      }
      const currentMemberCount = requireMemberCount(householdSnapshot.data()?.memberCount);
      if (tier === "standard" && currentMemberCount > MAX_STANDARD_MEMBERS) {
        throw new HttpsError(
          "failed-precondition",
          "Le plan Pro est requis à partir de huit membres.",
        );
      }

      const appBaseUrl = requireHttpsBaseUrl(APP_BASE_URL.value());
      const priceId = priceForTier(tier);
      const billingData = billingSnapshot.data();
      const existingCustomerId = billingData?.stripeCustomerId;
      const params: Stripe.Checkout.SessionCreateParams = {
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        client_reference_id: householdId,
        success_url: `${appBaseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appBaseUrl}/billing/cancel`,
        metadata: {
          integration: "chorescore-v1",
          householdId,
          requestedTier: tier,
          requestedBy: caller.uid,
        },
        subscription_data: {
          metadata: {
            integration: "chorescore-v1",
            householdId,
            requestedTier: tier,
          },
        },
      };
      if (typeof existingCustomerId === "string" && existingCustomerId.startsWith("cus_")) {
        params.customer = existingCustomerId;
      }

      const stripe = stripeClient();
      const session = await stripe.checkout.sessions.create(params, {
        idempotencyKey: operationDocumentId(
          caller.uid,
          "createCheckoutSession",
          idempotencyKey,
        ),
      });
      if (session.url === null) {
        throw new HttpsError("internal", "Stripe n'a pas retourné d'URL de paiement.");
      }

      await db.doc(`checkoutSessions/${session.id}`).set({
        householdId,
        requestedTier: tier,
        requestedBy: caller.uid,
        stripeSessionId: session.id,
        status: "created",
        createdAt: Timestamp.now(),
      });

      return { url: session.url };
    } catch (error) {
      return handleCallableError(error, "createCheckoutSession");
    }
  },
);

function mapStripeStatus(value: string): StripeSubscriptionStatus {
  const statuses: readonly StripeSubscriptionStatus[] = [
    "active",
    "trialing",
    "past_due",
    "canceled",
    "unpaid",
    "incomplete",
    "incomplete_expired",
    "paused",
  ];
  return statuses.includes(value as StripeSubscriptionStatus)
    ? (value as StripeSubscriptionStatus)
    : "none";
}

function periodEndSeconds(subscription: Stripe.Subscription): number | null {
  const subscriptionRecord = subscription as unknown as Record<string, unknown>;
  const directValue = subscriptionRecord.current_period_end;
  if (typeof directValue === "number" && Number.isFinite(directValue)) {
    return directValue;
  }

  const itemValues = subscription.items.data
    .map((item) => (item as unknown as Record<string, unknown>).current_period_end)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return itemValues.length === 0 ? null : Math.max(...itemValues);
}

function tierFromSubscription(subscription: Stripe.Subscription): PaidTier | null {
  const standardPrice = STRIPE_STANDARD_PRICE_ID.value();
  const proPrice = STRIPE_PRO_PRICE_ID.value();
  if (standardPrice.length === 0 || proPrice.length === 0) {
    return null;
  }
  const priceIds = new Set(subscription.items.data.map((item) => item.price.id));
  const hasStandard = priceIds.has(standardPrice);
  const hasPro = priceIds.has(proPrice);
  if (hasStandard === hasPro) {
    return null;
  }
  return hasPro ? "pro" : "standard";
}

function customerIdFromSubscription(subscription: Stripe.Subscription): string | null {
  if (typeof subscription.customer === "string") {
    return subscription.customer;
  }
  return subscription.customer?.id ?? null;
}

async function recordIgnoredStripeEvent(event: Stripe.Event, reason: string): Promise<void> {
  const reference = db.doc(`stripeEvents/${event.id}`);
  await reference.create({
    type: event.type,
    stripeCreated: event.created,
    status: "ignored",
    reason,
    processedAt: Timestamp.now(),
  }).catch((error: unknown) => {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "";
    if (code !== "6" && code !== "already-exists") {
      throw error;
    }
  });
}

async function applySubscriptionState(
  event: Stripe.Event,
  subscription: Stripe.Subscription,
): Promise<void> {
  if (subscription.metadata.integration !== "chorescore-v1") {
    await recordIgnoredStripeEvent(event, "integration_metadata_missing");
    return;
  }
  const householdIdRaw = subscription.metadata.householdId;
  let householdId: string;
  try {
    householdId = firestoreId({ householdId: householdIdRaw }, "householdId");
  } catch {
    await recordIgnoredStripeEvent(event, "household_metadata_invalid");
    return;
  }

  const eventReference = db.doc(`stripeEvents/${event.id}`);
  const householdReference = db.doc(`households/${householdId}`);
  const billingReference = db.doc(`billingHouseholds/${householdId}`);
  const now = Timestamp.now();
  const paidTier = tierFromSubscription(subscription);
  const stripeStatus = mapStripeStatus(subscription.status);
  const periodEnd = periodEndSeconds(subscription);
  const stripeCustomerId = customerIdFromSubscription(subscription);

  await db.runTransaction(async (transaction) => {
    const eventSnapshot = await transaction.get(eventReference);
    if (eventSnapshot.exists) {
      return;
    }
    const householdSnapshot = await transaction.get(householdReference);
    const billingSnapshot = await transaction.get(billingReference);
    if (!householdSnapshot.exists || !billingSnapshot.exists) {
      transaction.create(eventReference, {
        type: event.type,
        stripeCreated: event.created,
        status: "rejected",
        reason: "household_or_billing_missing",
        processedAt: now,
      });
      return;
    }

    const billingData = billingSnapshot.data();

    // Invariant : aucun événement ancien ne peut écraser un état
    // d'abonnement plus récent. La décision est prise dans la transaction,
    // sur le marqueur du dernier événement appliqué.
    const orderDecision = decideSubscriptionEventOrder(
      { eventId: event.id, eventCreatedSeconds: event.created },
      {
        lastStripeEventId: billingData?.lastStripeEventId,
        lastStripeEventCreated: billingData?.lastStripeEventCreated,
      },
    );
    if (orderDecision.outcome === "duplicate") {
      transaction.create(eventReference, {
        type: event.type,
        stripeCreated: event.created,
        status: "ignored",
        reason: "duplicate_event",
        processedAt: now,
      });
      return;
    }
    if (orderDecision.outcome === "reject") {
      transaction.create(eventReference, {
        type: event.type,
        stripeCreated: event.created,
        status: "rejected",
        reason: orderDecision.reason,
        householdId,
        processedAt: now,
      });
      return;
    }

    const existingCustomerId = billingData?.stripeCustomerId;
    if (
      typeof existingCustomerId === "string" &&
      stripeCustomerId !== null &&
      existingCustomerId !== stripeCustomerId
    ) {
      transaction.create(eventReference, {
        type: event.type,
        stripeCreated: event.created,
        status: "rejected",
        reason: "stripe_customer_mismatch",
        processedAt: now,
      });
      return;
    }

    // Échec fermé : un champ d'ordre présent mais illisible désactiverait les
    // gardes ; l'événement est rejeté plutôt qu'appliqué sans protection.
    const rawStoredSubscriptionId = billingData?.stripeSubscriptionId;
    const rawStoredLastCreated = billingData?.lastStripeEventCreated;
    const rawStoredTier = billingData?.paidTier;
    const rawStoredPeriodEnd = billingData?.stripeCurrentPeriodEnd;
    const rawStoredStatus = billingData?.stripeStatus;
    const storedStateCorrupted = storedBillingStateIsUnreadable(
      {
        stripeSubscriptionId: rawStoredSubscriptionId,
        lastStripeEventCreated: rawStoredLastCreated,
        paidTier: rawStoredTier,
        stripeCurrentPeriodEnd: rawStoredPeriodEnd,
        stripeStatus: rawStoredStatus,
      },
      (value) => value instanceof Timestamp,
    );
    if (storedStateCorrupted) {
      transaction.create(eventReference, {
        type: event.type,
        stripeCreated: event.created,
        status: "rejected",
        reason: "billing_state_unparseable",
        processedAt: now,
      });
      return;
    }

    // Garde d'ordre : un événement ancien, résiliant un abonnement remplacé ou
    // rétrogradant un abonnement vivant ne doit jamais écraser un état
    // d'abonnement plus récent.
    const decision = decideSubscriptionEventApplication(
      {
        eventCreatedSeconds: event.created,
        subscriptionId: subscription.id,
        stripeStatus,
        tier: paidTier,
      },
      {
        stripeSubscriptionId:
          typeof rawStoredSubscriptionId === "string"
            ? rawStoredSubscriptionId
            : null,
        lastStripeEventCreatedSeconds:
          typeof rawStoredLastCreated === "number" ? rawStoredLastCreated : null,
        stripeStatus: mapStripeStatus(
          typeof rawStoredStatus === "string" ? rawStoredStatus : "",
        ),
        stripeCurrentPeriodEndMs:
          rawStoredPeriodEnd instanceof Timestamp
            ? rawStoredPeriodEnd.toMillis()
            : null,
        tier:
          rawStoredTier === "standard" || rawStoredTier === "pro"
            ? rawStoredTier
            : null,
      },
      now.toMillis(),
    );
    if (decision.action === "ignore") {
      transaction.create(eventReference, {
        type: event.type,
        stripeCreated: event.created,
        status: "rejected",
        reason: decision.reason,
        processedAt: now,
      });
      return;
    }

    const nextBillingState = {
      ...billingStateFromDocument(billingData),
      paidTier,
      stripeStatus,
      stripeCurrentPeriodEndMs:
        periodEnd === null ? null : periodEnd * 1000,
    };
    const currentMemberCount = requireMemberCount(householdSnapshot.data()?.memberCount);
    const resolution = resolvePlan(nextBillingState, now.toMillis(), currentMemberCount);
    const validUntilMs =
      resolution.plan === "trial"
        ? nextBillingState.trialEndsAtMs
        : resolution.plan === "standard" || resolution.plan === "pro"
          ? nextBillingState.stripeCurrentPeriodEndMs
          : null;

    transaction.update(billingReference, {
      paidTier,
      stripeStatus,
      stripeCurrentPeriodEnd:
        periodEnd === null ? null : Timestamp.fromMillis(periodEnd * 1000),
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      lastStripeEventId: event.id,
      lastStripeEventCreated: event.created,
      updatedAt: now,
    });
    transaction.update(householdReference, {
      entitlementSnapshot: publicPlanSnapshot(
        resolution.plan,
        validUntilMs,
        resolution.standardMemberLimitExceeded,
      ),
      updatedAt: now,
    });
    transaction.create(eventReference, {
      type: event.type,
      stripeCreated: event.created,
      status: paidTier === null ? "processed_fail_closed" : "processed",
      householdId,
      processedAt: now,
    });
  });
}

export const stripeWebhook = onRequest(
  {
    region: FUNCTION_REGION,
    timeoutSeconds: 60,
    maxInstances: 20,
    cors: false,
    secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET],
  },
  async (request, response) => {
    if (!STRIPE_ENABLED.value()) {
      response.status(503).json({ error: "stripe_disabled" });
      return;
    }
    if (request.method !== "POST") {
      response.set("Allow", "POST").status(405).json({ error: "method_not_allowed" });
      return;
    }

    const signature = request.header("stripe-signature");
    if (signature === undefined) {
      response.status(400).json({ error: "signature_required" });
      return;
    }

    let event: Stripe.Event;
    let stripe: Stripe;
    try {
      stripe = stripeClient();
      event = stripe.webhooks.constructEvent(
        request.rawBody,
        signature,
        requireConfiguredValue(
          "STRIPE_WEBHOOK_SECRET",
          STRIPE_WEBHOOK_SECRET.value(),
        ),
      );
    } catch {
      response.status(400).json({ error: "invalid_signature" });
      return;
    }

    if (event.livemode !== STRIPE_LIVE_MODE.value()) {
      response.status(400).json({ error: "stripe_mode_mismatch" });
      return;
    }

    try {
      const existing = await db.doc(`stripeEvents/${event.id}`).get();
      if (existing.exists) {
        response.status(200).json({ received: true, duplicate: true });
        return;
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.integration !== "chorescore-v1") {
          await recordIgnoredStripeEvent(event, "integration_metadata_missing");
        } else {
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id;
          if (subscriptionId === undefined) {
            await recordIgnoredStripeEvent(event, "subscription_missing");
          } else {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            await applySubscriptionState(event, subscription);
          }
        }
      } else if (HANDLED_SUBSCRIPTION_EVENTS.has(event.type)) {
        const eventSubscription = event.data.object as Stripe.Subscription;
        let canonicalSubscription: Stripe.Subscription;
        try {
          canonicalSubscription = await stripe.subscriptions.retrieve(eventSubscription.id);
        } catch (error) {
          if (event.type !== "customer.subscription.deleted") {
            throw error;
          }
          canonicalSubscription = eventSubscription;
        }
        await applySubscriptionState(event, canonicalSubscription);
      } else {
        await recordIgnoredStripeEvent(event, "event_type_not_used");
      }

      response.status(200).json({ received: true });
    } catch (error) {
      logger.error("Stripe webhook processing failed", {
        eventId: event.id,
        eventType: event.type,
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      response.status(500).json({ error: "processing_failed" });
    }
  },
);
