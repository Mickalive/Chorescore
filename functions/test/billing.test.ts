import assert from "node:assert/strict";
import test from "node:test";

import Stripe from "stripe";

import {
  decideSubscriptionEventApplication,
  StoredSubscriptionOrdering,
} from "../src/domain";
import { storedBillingStateIsUnreadable } from "../src/billingOrder";

/**
 * Ces tests restent en logique pure et crypto locale : aucun émulateur,
 * aucun réseau, aucun secret réel. Le secret ci-dessous est une valeur de
 * test factice réservée à ce fichier.
 */
const WEBHOOK_SECRET = "whsec_local_unit_test_only";
const NOW_MS = Date.UTC(2026, 7, 24, 12);

function stored(overrides?: Partial<StoredSubscriptionOrdering>): StoredSubscriptionOrdering {
  return {
    stripeSubscriptionId: "sub_current",
    lastStripeEventCreatedSeconds: 1_000,
    stripeStatus: "active",
    stripeCurrentPeriodEndMs: NOW_MS + 86_400_000,
    tier: "pro",
    ...overrides,
  };
}

test("un premier événement s'applique en l'absence d'état suivi", () => {
  const decision = decideSubscriptionEventApplication(
    {
      eventCreatedSeconds: 500,
      subscriptionId: "sub_new",
      stripeStatus: "active",
      tier: "standard",
    },
    {
      stripeSubscriptionId: null,
      lastStripeEventCreatedSeconds: null,
      stripeStatus: "none",
      stripeCurrentPeriodEndMs: null,
      tier: null,
    },
    NOW_MS,
  );
  assert.deepEqual(decision, { action: "apply" });
});

test("un événement strictement plus ancien que le dernier appliqué est ignoré", () => {
  const lateSameSubscription = decideSubscriptionEventApplication(
    {
      eventCreatedSeconds: 999,
      subscriptionId: "sub_current",
      stripeStatus: "active",
      tier: "pro",
    },
    stored(),
    NOW_MS,
  );
  assert.deepEqual(lateSameSubscription, {
    action: "ignore",
    reason: "stale_event_ordering",
  });

  const lateOtherSubscription = decideSubscriptionEventApplication(
    {
      eventCreatedSeconds: 1,
      subscriptionId: "sub_old",
      stripeStatus: "active",
      tier: "pro",
    },
    stored(),
    NOW_MS,
  );
  assert.deepEqual(lateOtherSubscription, {
    action: "ignore",
    reason: "stale_event_ordering",
  });
});

test("l'égalité de l'horodatage reste applicable", () => {
  const decision = decideSubscriptionEventApplication(
    {
      eventCreatedSeconds: 1_000,
      subscriptionId: "sub_current",
      stripeStatus: "active",
      tier: "pro",
    },
    stored(),
    NOW_MS,
  );
  assert.deepEqual(decision, { action: "apply" });
});

test("la résiliation d'un ancien abonnement n'écrase pas l'abonnement suivi", () => {
  for (const status of [
    "canceled",
    "past_due",
    "unpaid",
    "incomplete",
    "incomplete_expired",
    "paused",
  ] as const) {
    const decision = decideSubscriptionEventApplication(
      {
        eventCreatedSeconds: 2_000,
        subscriptionId: "sub_old",
        stripeStatus: status,
        tier: "standard",
      },
      stored({ lastStripeEventCreatedSeconds: 1_000 }),
      NOW_MS,
    );
    assert.deepEqual(decision, {
      action: "ignore",
      reason: "superseded_subscription_terminal",
    });
  }
});

test("le renouvellement tardif d'un ancien abonnement vivant ne rétrograde pas le droit", () => {
  const decision = decideSubscriptionEventApplication(
    {
      eventCreatedSeconds: 2_000,
      subscriptionId: "sub_old_standard",
      stripeStatus: "active",
      tier: "standard",
    },
    stored({ stripeSubscriptionId: "sub_current_pro", tier: "pro" }),
    NOW_MS,
  );
  assert.deepEqual(decision, {
    action: "ignore",
    reason: "superseded_subscription_live",
  });
});

test("une bascule vers un rang inconnu est refusée tant que l'accès suivi est courant", () => {
  for (const tier of [null] as const) {
    const decision = decideSubscriptionEventApplication(
      {
        eventCreatedSeconds: 2_000,
        subscriptionId: "sub_unmapped_prices",
        stripeStatus: "active",
        tier,
      },
      stored({ stripeSubscriptionId: "sub_current_pro", tier: "pro" }),
      NOW_MS,
    );
    assert.deepEqual(decision, {
      action: "ignore",
      reason: "superseded_subscription_live",
    });
  }
});

test("un abonnement vivant de rang supérieur ou égal prend le relais", () => {
  const upgrade = decideSubscriptionEventApplication(
    {
      eventCreatedSeconds: 2_000,
      subscriptionId: "sub_new_pro",
      stripeStatus: "active",
      tier: "pro",
    },
    stored({ stripeSubscriptionId: "sub_old_standard", tier: "standard" }),
    NOW_MS,
  );
  assert.deepEqual(upgrade, { action: "apply" });

  const sameTier = decideSubscriptionEventApplication(
    {
      eventCreatedSeconds: 2_000,
      subscriptionId: "sub_other_pro",
      stripeStatus: "trialing",
      tier: "pro",
    },
    stored({ stripeSubscriptionId: "sub_current_pro", tier: "pro" }),
    NOW_MS,
  );
  assert.deepEqual(sameTier, { action: "apply" });
});

test("après expiration de l'accès suivi, un abonnement vivant différent reprend le service", () => {
  const decision = decideSubscriptionEventApplication(
    {
      eventCreatedSeconds: 2_000,
      subscriptionId: "sub_replacement_standard",
      stripeStatus: "active",
      tier: "standard",
    },
    stored({
      stripeSubscriptionId: "sub_expired_pro",
      tier: "pro",
      stripeCurrentPeriodEndMs: NOW_MS - 1,
    }),
    NOW_MS,
  );
  assert.deepEqual(decision, { action: "apply" });
});

test("la résiliation du bon abonnement s'applique", () => {
  const decision = decideSubscriptionEventApplication(
    {
      eventCreatedSeconds: 2_000,
      subscriptionId: "sub_current",
      stripeStatus: "canceled",
      tier: "pro",
    },
    stored({ lastStripeEventCreatedSeconds: 1_000 }),
    NOW_MS,
  );
  assert.deepEqual(decision, { action: "apply" });
});

test("sans abonnement suivi, un événement terminal s'applique dans le sens fermé", () => {
  const decision = decideSubscriptionEventApplication(
    {
      eventCreatedSeconds: 2_000,
      subscriptionId: "sub_unknown",
      stripeStatus: "canceled",
      tier: null,
    },
    {
      stripeSubscriptionId: null,
      lastStripeEventCreatedSeconds: null,
      stripeStatus: "none",
      stripeCurrentPeriodEndMs: null,
      tier: null,
    },
    NOW_MS,
  );
  assert.deepEqual(decision, { action: "apply" });
});

const isTimestamp = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  "toMillis" in value &&
  typeof (value as { toMillis: unknown }).toMillis === "function";

function storedFields(
  overrides?: Partial<Parameters<typeof storedBillingStateIsUnreadable>[0]>,
): Parameters<typeof storedBillingStateIsUnreadable>[0] {
  return {
    stripeSubscriptionId: "sub_current",
    lastStripeEventCreated: 1_000,
    paidTier: "pro",
    stripeCurrentPeriodEnd: { toMillis: () => NOW_MS + 86_400_000 },
    stripeStatus: "active",
    ...overrides,
  };
}

test("un état de facturation lisible n'est pas déclaré corrompu", () => {
  assert.equal(storedBillingStateIsUnreadable(storedFields(), isTimestamp), false);
  assert.equal(
    storedBillingStateIsUnreadable(
      storedFields({
        stripeSubscriptionId: undefined,
        lastStripeEventCreated: undefined,
        paidTier: undefined,
        stripeCurrentPeriodEnd: undefined,
        stripeStatus: undefined,
      }),
      isTimestamp,
    ),
    false,
  );
  assert.equal(
    storedBillingStateIsUnreadable(storedFields({ stripeStatus: null }), isTimestamp),
    false,
  );
});

test("un champ d'ordre présent mais illisible rend l'état corrompu, y compris stripeStatus", () => {
  const corruptedStates = [
    storedFields({ stripeSubscriptionId: 42 }),
    storedFields({ lastStripeEventCreated: "1000" }),
    storedFields({ lastStripeEventCreated: Number.NaN }),
    storedFields({ paidTier: "gold" }),
    storedFields({ stripeCurrentPeriodEnd: "2026-08-24" }),
    // C1 : un stripeStatus non textuel ne doit pas être réduit silencieusement
    // à « none » : il doit faire échouer fermé la garde.
    storedFields({ stripeStatus: 7 }),
  ];
  for (const state of corruptedStates) {
    assert.equal(storedBillingStateIsUnreadable(state, isTimestamp), true);
  }
});

function signedSubscriptionEventPayload(): string {
  return JSON.stringify({
    id: "evt_test_ordering_1",
    object: "event",
    created: 1_756_000_000,
    data: {
      object: {
        id: "sub_test_ordering_1",
        object: "subscription",
        status: "active",
        metadata: {
          integration: "chorescore-v1",
          householdId: "home123abc",
        },
      },
    },
    livemode: false,
    type: "customer.subscription.updated",
  });
}

test("une charge utile correctement signée est acceptée et décodée", () => {
  const stripe = new Stripe(WEBHOOK_SECRET);
  const payload = signedSubscriptionEventPayload();
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });

  const event = stripe.webhooks.constructEvent(payload, header, WEBHOOK_SECRET);
  assert.equal(event.id, "evt_test_ordering_1");
  assert.equal(event.type, "customer.subscription.updated");
  assert.equal(event.livemode, false);
});

test("une charge utile altérée après signature est refusée", () => {
  const stripe = new Stripe(WEBHOOK_SECRET);
  const payload = signedSubscriptionEventPayload();
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  const tampered = payload.replace("chorescore-v1", "chorescore-v2");

  assert.throws(() => stripe.webhooks.constructEvent(tampered, header, WEBHOOK_SECRET));
});

test("une signature calculée avec un autre secret est refusée", () => {
  const stripe = new Stripe(WEBHOOK_SECRET);
  const payload = signedSubscriptionEventPayload();
  const header = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: "whsec_attacker_controlled_value",
  });

  assert.throws(() => stripe.webhooks.constructEvent(payload, header, WEBHOOK_SECRET));
});

test("un en-tête de signature malformé est refusé", () => {
  const stripe = new Stripe(WEBHOOK_SECRET);
  const payload = signedSubscriptionEventPayload();

  assert.throws(() =>
    stripe.webhooks.constructEvent(payload, "not-a-stripe-signature", WEBHOOK_SECRET),
  );
});
