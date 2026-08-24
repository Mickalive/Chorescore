import assert from "node:assert/strict";
import test from "node:test";

import {
  AppliedSubscriptionMarker,
  decideSubscriptionEventOrder,
  IncomingSubscriptionEvent,
} from "../src/billingOrder";

const LAST_APPLIED_SECONDS = 1_756_000_000;

function applied(
  lastStripeEventId: unknown,
  lastStripeEventCreated: unknown,
): AppliedSubscriptionMarker {
  return { lastStripeEventId, lastStripeEventCreated };
}

function incoming(
  eventId: string,
  eventCreatedSeconds: number,
): IncomingSubscriptionEvent {
  return { eventId, eventCreatedSeconds };
}

test("un événement d'abonnement plus ancien que l'état appliqué est refusé", () => {
  const decision = decideSubscriptionEventOrder(
    incoming("evt_late_delivery", LAST_APPLIED_SECONDS - 60),
    applied("evt_current", LAST_APPLIED_SECONDS),
  );
  assert.deepEqual(decision, { outcome: "reject", reason: "stale_event" });
});

test("un événement plus récent ou de même seconde que le marqueur est appliqué", () => {
  assert.deepEqual(
    decideSubscriptionEventOrder(
      incoming("evt_next", LAST_APPLIED_SECONDS + 1),
      applied("evt_previous", LAST_APPLIED_SECONDS),
    ),
    { outcome: "apply" },
  );
  // Deux événements distincts peuvent partager la même seconde Stripe :
  // aucun des deux n'est prouvé plus ancien, donc il est appliqué.
  assert.deepEqual(
    decideSubscriptionEventOrder(
      incoming("evt_same_second", LAST_APPLIED_SECONDS),
      applied("evt_other", LAST_APPLIED_SECONDS),
    ),
    { outcome: "apply" },
  );
});

test("le rejeu du dernier événement appliqué est détecté comme doublon", () => {
  const decision = decideSubscriptionEventOrder(
    incoming("evt_current", LAST_APPLIED_SECONDS - 100),
    applied("evt_current", LAST_APPLIED_SECONDS),
  );
  assert.deepEqual(decision, { outcome: "duplicate" });
});

test("une enveloppe d'événement invalide est refusée sans être appliquée", () => {
  const noHistory = applied(null, null);
  assert.deepEqual(
    decideSubscriptionEventOrder(incoming("", 100), noHistory),
    { outcome: "reject", reason: "invalid_event_envelope" },
  );
  assert.deepEqual(
    decideSubscriptionEventOrder(incoming("evt_x", -1), noHistory),
    { outcome: "reject", reason: "invalid_event_envelope" },
  );
  assert.deepEqual(
    decideSubscriptionEventOrder(incoming("evt_x", 1.5), noHistory),
    { outcome: "reject", reason: "invalid_event_envelope" },
  );
  assert.deepEqual(
    decideSubscriptionEventOrder(incoming("evt_x", Number.NaN), noHistory),
    { outcome: "reject", reason: "invalid_event_envelope" },
  );
  assert.deepEqual(
    decideSubscriptionEventOrder(incoming("evt_x", Number.POSITIVE_INFINITY), noHistory),
    { outcome: "reject", reason: "invalid_event_envelope" },
  );
});

test("sans historique appliqué, le premier événement est appliqué", () => {
  assert.deepEqual(
    decideSubscriptionEventOrder(
      incoming("evt_first", 1_700_000_000),
      applied(undefined, undefined),
    ),
    { outcome: "apply" },
  );
  assert.deepEqual(
    decideSubscriptionEventOrder(
      incoming("evt_first", 1_700_000_000),
      applied(null, null),
    ),
    { outcome: "apply" },
  );
});

test("un marqueur d'historique corrompu est ignoré de façon déterministe", () => {
  // Comportement documenté : un marqueur non numérique ne permet pas de
  // prouver l'ancienneté ; la décision est alors « apply » et la protection
  // repose sur la déduplication par identifiant.
  assert.deepEqual(
    decideSubscriptionEventOrder(
      incoming("evt_a", 1_700_000_000),
      applied("evt_b", "pas-un-nombre"),
    ),
    { outcome: "apply" },
  );
  assert.deepEqual(
    decideSubscriptionEventOrder(
      incoming("evt_a", 1_700_000_000),
      applied("evt_b", Number.NaN),
    ),
    { outcome: "apply" },
  );
});

test("l'ordre reste monotone quel que soit l'écart entre horodatages", () => {
  for (const gap of [1, 2, 3_600, 86_400, 2_592_000]) {
    const marker = applied("evt_applied", LAST_APPLIED_SECONDS);
    assert.equal(
      decideSubscriptionEventOrder(
        incoming("evt_late", LAST_APPLIED_SECONDS - gap),
        marker,
      ).outcome,
      "reject",
      `écart ${gap}s : l'événement ancien doit être refusé`,
    );
    assert.equal(
      decideSubscriptionEventOrder(
        incoming("evt_fresh", LAST_APPLIED_SECONDS + gap),
        marker,
      ).outcome,
      "apply",
      `écart ${gap}s : l'événement récent doit être appliqué`,
    );
  }
});
