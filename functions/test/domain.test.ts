import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateScore,
  createOpaqueInviteToken,
  getEffectiveWeight,
  isoWeekKey,
  resolvePlan,
} from "../src/domain";

const NOW = Date.UTC(2026, 7, 24, 12);

test("le score serveur reste exact et le gratuit force le poids à 1", () => {
  assert.equal(calculateScore(91, 3), 4.55);
  assert.equal(getEffectiveWeight("free", 999), 1);
  assert.equal(getEffectiveWeight("trial", 999), 999);
  assert.throws(() => calculateScore(0, 1), /INVALID_DURATION/);
  assert.throws(() => calculateScore(60, 1001), /INVALID_WEIGHT/);
});

test("les plans payants dépendent d'un statut Stripe actif et non expiré", () => {
  assert.deepEqual(
    resolvePlan(
      {
        paidTier: "standard",
        stripeStatus: "active",
        stripeCurrentPeriodEndMs: NOW + 60_000,
        trialEndsAtMs: NOW - 1,
      },
      NOW,
      7,
    ),
    { plan: "standard", memberLimit: 7, standardMemberLimitExceeded: false },
  );

  const exceeded = resolvePlan(
    {
      paidTier: "standard",
      stripeStatus: "active",
      stripeCurrentPeriodEndMs: NOW + 60_000,
      trialEndsAtMs: NOW - 1,
    },
    NOW,
    8,
  );
  assert.equal(exceeded.plan, "standard");
  assert.equal(exceeded.standardMemberLimitExceeded, true);

  assert.equal(
    resolvePlan(
      {
        paidTier: "pro",
        stripeStatus: "past_due",
        stripeCurrentPeriodEndMs: NOW + 60_000,
        trialEndsAtMs: NOW - 1,
      },
      NOW,
      8,
    ).plan,
    "free",
  );
});

test("l'essai dure jusqu'à sa date serveur et les invitations ont une forte entropie", () => {
  const plan = resolvePlan(
    {
      paidTier: null,
      stripeStatus: "none",
      stripeCurrentPeriodEndMs: null,
      trialEndsAtMs: NOW + 1,
    },
    NOW,
    42,
  );
  assert.equal(plan.plan, "trial");
  assert.equal(plan.memberLimit, 100);

  const first = createOpaqueInviteToken();
  const second = createOpaqueInviteToken();
  assert.match(first, /^[A-Za-z0-9_-]{43}$/u);
  assert.notEqual(first, second);
});

test("la clé hebdomadaire respecte le fuseau du foyer", () => {
  assert.equal(isoWeekKey(new Date("2026-08-24T00:30:00+02:00"), "Europe/Zurich"), "2026-W35");
});
