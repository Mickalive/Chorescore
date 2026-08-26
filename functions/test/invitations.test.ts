import assert from "node:assert/strict";
import test from "node:test";

import { createOpaqueInviteToken } from "../src/domain";
import {
  decideInviteCreation,
  decideInviteRedemption,
  decideInviteRedemptionCapacity,
  inviteDigest,
  inviteTokenEntropyBits,
  isValidInviteTokenShape,
  isValidStoredHouseholdId,
  InviteCapacity,
  InviteCreationInput,
  InviteRedemptionInput,
  MAX_INVITE_EXPIRY_HOURS,
  MIN_INVITE_EXPIRY_HOURS,
  MIN_INVITE_TOKEN_ENTROPY_BITS,
} from "../src/invitations";
import { observedCaller, ObservedCallableRequest } from "../src/observedCaller";

const NOW = Date.UTC(2026, 7, 24, 12);
const HOUR_MS = 3_600_000;
// Exactement 43 caractères base64url : la forme canonique d'un jeton.
const VALID_TOKEN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq";

const DEFAULT_CAPACITY: InviteCapacity = {
  status: "available",
  memberLimit: 100,
  standardMemberLimitExceeded: false,
};

function creationInput(overrides?: Partial<InviteCreationInput>): InviteCreationInput {
  return {
    caller: {
      authenticated: true,
      appCheckAttested: true,
      emailVerified: true,
      uid: "user_1",
    },
    membership: {
      exists: true,
      status: "active",
      role: "owner",
    },
    household: {
      exists: true,
      memberCount: 2,
    },
    capacity: DEFAULT_CAPACITY,
    expectedHouseholdId: "household_a",
    expiresInHours: 24,
    nowMs: NOW,
    ...overrides,
  };
}

interface RedemptionFixture extends InviteRedemptionInput {
  readonly capacity: InviteCapacity;
  readonly householdMemberCount: unknown;
}

function redemptionInput(overrides?: Partial<RedemptionFixture>): RedemptionFixture {
  return {
    caller: {
      authenticated: true,
      appCheckAttested: true,
      emailVerified: true,
      uid: "user_9",
    },
    invite: {
      exists: true,
      householdId: "household_b",
      status: "active",
      useCount: 0,
      redeemedBy: null,
      expiresAtMs: NOW + HOUR_MS,
      revokedAt: null,
    },
    householdExists: true,
    householdMemberCount: 2,
    membershipStatus: undefined,
    capacity: DEFAULT_CAPACITY,
    rawToken: VALID_TOKEN,
    nowMs: NOW,
    ...overrides,
  };
}

/**
 * Enchaîne les deux phases de la décision d'acceptation, comme le câblage :
 * la capacité n'est consultée que si la première phase le demande.
 */
function decideRedemption(full: RedemptionFixture):
  | ReturnType<typeof decideInviteRedemption>
  | ReturnType<typeof decideInviteRedemptionCapacity> {
  const pre = decideInviteRedemption(full);
  if (pre.outcome !== "evaluate_capacity") {
    return pre;
  }
  return decideInviteRedemptionCapacity({
    householdId: pre.householdId,
    capacity: full.capacity,
    householdMemberCount: full.householdMemberCount,
    alreadyActiveMember: full.membershipStatus === "active",
  });
}

// --- Création d'invitation -------------------------------------------------

test("une création nominale fixe l'expiration depuis le temps serveur", () => {
  assert.deepEqual(decideInviteCreation(creationInput()), {
    outcome: "accept",
    expiresAtMs: NOW + 24 * HOUR_MS,
  });
  for (const hours of [MIN_INVITE_EXPIRY_HOURS, MAX_INVITE_EXPIRY_HOURS]) {
    const decision = decideInviteCreation(creationInput({ expiresInHours: hours }));
    assert.deepEqual(decision, {
      outcome: "accept",
      expiresAtMs: NOW + hours * HOUR_MS,
    });
  }
});

test("un appel sans Authentification Firebase est refusé", () => {
  assert.deepEqual(
    decideInviteCreation(
      creationInput({ caller: { authenticated: false, appCheckAttested: true, emailVerified: true, uid: "user_1" } }),
    ),
    { outcome: "reject", code: "unauthenticated", message: "Authentification requise." },
  );
  assert.equal(
    decideInviteCreation(
      creationInput({ caller: { authenticated: true, appCheckAttested: true, emailVerified: true, uid: 42 } }),
    ).outcome,
    "reject",
  );
  assert.equal(
    decideInviteCreation(
      creationInput({ caller: { authenticated: true, appCheckAttested: true, emailVerified: true, uid: "" } }),
    ).outcome,
    "reject",
  );
});

test("un appel sans attestation App Check est refusé", () => {
  assert.deepEqual(
    decideInviteCreation(
      creationInput({ caller: { authenticated: true, appCheckAttested: false, emailVerified: true, uid: "user_1" } }),
    ),
    { outcome: "reject", code: "failed-precondition", message: "Attestation App Check requise." },
  );
});

test("un appel avec une adresse email non vérifiée est refusé", () => {
  for (const flag of [false, undefined, "yes"]) {
    assert.deepEqual(
      decideInviteCreation(
        creationInput({
          caller: {
            authenticated: true,
            appCheckAttested: true,
            // Défense profonde : la valeur traverse une frontière et doit être
            // strictement `true`, jamais coercée.
            emailVerified: flag as boolean,
            uid: "user_1",
          },
        }),
      ),
      {
        outcome: "reject",
        code: "failed-precondition",
        message: "Une adresse email vérifiée est requise.",
      },
    );
  }
});

test("un membre simple ne peut pas créer d'invitation : rôle insuffisant", () => {
  assert.deepEqual(
    decideInviteCreation(creationInput({ membership: { exists: true, status: "active", role: "member" } })),
    { outcome: "reject", code: "permission-denied", message: "Autorisation insuffisante." },
  );
  for (const role of [42, "superadmin", null, undefined]) {
    assert.deepEqual(
      decideInviteCreation(creationInput({ membership: { exists: true, status: "active", role } })),
      { outcome: "reject", code: "permission-denied", message: "Accès au foyer refusé." },
    );
  }
  assert.deepEqual(
    decideInviteCreation(creationInput({ membership: { exists: false, status: undefined, role: undefined } })),
    { outcome: "reject", code: "permission-denied", message: "Accès au foyer refusé." },
  );
  assert.deepEqual(
    decideInviteCreation(creationInput({ membership: { exists: true, status: "removed", role: "owner" } })),
    { outcome: "reject", code: "permission-denied", message: "Accès au foyer refusé." },
  );
});

test("l'isolation entre deux foyers : seul le rôle stocké dans le foyer ciblé compte", () => {
  // user_1 est propriétaire du foyer A mais n'a aucune adhésion dans le
  // foyer B : une création ciblant B est refusée malgré son rôle ailleurs.
  assert.deepEqual(
    decideInviteCreation(
      creationInput({
        expectedHouseholdId: "household_b",
        membership: { exists: false, status: undefined, role: undefined },
      }),
    ),
    { outcome: "reject", code: "permission-denied", message: "Accès au foyer refusé." },
  );

  // Membre simple du foyer B : refusé aussi, même avec un rôle propriétaire
  // conservé dans le foyer A.
  assert.deepEqual(
    decideInviteCreation(
      creationInput({
        expectedHouseholdId: "household_b",
        membership: { exists: true, status: "active", role: "member" },
      }),
    ),
    { outcome: "reject", code: "permission-denied", message: "Autorisation insuffisante." },
  );

  // Administrateur du foyer B : la même personne crée l'invitation.
  assert.equal(
    decideInviteCreation(
      creationInput({
        expectedHouseholdId: "household_b",
        membership: { exists: true, status: "active", role: "admin" },
      }),
    ).outcome,
    "accept",
  );
});

test("un foyer introuvable ne peut pas recevoir d'invitation", () => {
  assert.deepEqual(
    decideInviteCreation(creationInput({ household: { exists: false, memberCount: undefined } })),
    { outcome: "reject", code: "not-found", message: "Foyer introuvable." },
  );
});

test("la limite de places du plan ferme la création d'invitation", () => {
  assert.deepEqual(
    decideInviteCreation(
      creationInput({ capacity: { status: "available", memberLimit: 7, standardMemberLimitExceeded: true } }),
    ),
    {
      outcome: "reject",
      code: "failed-precondition",
      message: "Ce foyer doit utiliser le plan Pro avant d'inviter un membre supplémentaire.",
    },
  );
  assert.deepEqual(
    decideInviteCreation(
      creationInput({ household: { exists: true, memberCount: 7 }, capacity: { status: "available", memberLimit: 7, standardMemberLimitExceeded: false } }),
    ),
    {
      outcome: "reject",
      code: "failed-precondition",
      message: "Ce foyer doit utiliser le plan Pro avant d'inviter un membre supplémentaire.",
    },
  );
  assert.equal(
    decideInviteCreation(
      creationInput({ household: { exists: true, memberCount: 6 }, capacity: { status: "available", memberLimit: 7, standardMemberLimitExceeded: false } }),
    ).outcome,
    "accept",
  );
});

test("une composition de foyer illisible échoue fermée sans coercion", () => {
  for (const memberCount of [undefined, null, "2", 0, -1, 101, 2.5, Number.NaN]) {
    assert.deepEqual(
      decideInviteCreation(creationInput({ household: { exists: true, memberCount } })),
      { outcome: "fail_closed", reason: "invalid_household_state" },
    );
  }
});

test("un état de facturation indisponible échoue fermé", () => {
  assert.deepEqual(
    decideInviteCreation(creationInput({ capacity: { status: "billing_unavailable" } })),
    { outcome: "fail_closed", reason: "billing_unavailable" },
  );
});

test("la borne défensive d'expiration reste 1 à 72 heures", () => {
  for (const hours of [0, -1, 73, 2.5, "24", Number.NaN]) {
    assert.deepEqual(
      decideInviteCreation(creationInput({ expiresInHours: hours })),
      {
        outcome: "reject",
        code: "invalid-argument",
        message: "expiresInHours doit être un entier entre 1 et 72.",
      },
    );
  }
});

test("une enveloppe de requête serveur invalide échoue fermée", () => {
  for (const nowMs of [Number.NaN, 1.5, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(
      decideInviteCreation(creationInput({ nowMs })),
      { outcome: "fail_closed", reason: "invalid_request_envelope" },
    );
  }
  assert.deepEqual(
    decideInviteCreation(creationInput({ expectedHouseholdId: "" })),
    { outcome: "fail_closed", reason: "invalid_request_envelope" },
  );
});

// --- Acceptation d'invitation ----------------------------------------------

test("une acceptation nominale attribue le rôle membre dans le foyer de l'invitation", () => {
  assert.deepEqual(decideRedemption(redemptionInput()), {
    outcome: "accept",
    householdId: "household_b",
    assignedRole: "member",
  });
});

test("un appel sans Authentification Firebase est refusé à l'acceptation", () => {
  assert.deepEqual(
    decideRedemption(
      redemptionInput({ caller: { authenticated: false, appCheckAttested: true, emailVerified: true, uid: "user_9" } }),
    ),
    { outcome: "reject", code: "unauthenticated", message: "Authentification requise." },
  );
});

test("un appel sans attestation App Check est refusé à l'acceptation", () => {
  assert.deepEqual(
    decideRedemption(
      redemptionInput({ caller: { authenticated: true, appCheckAttested: false, emailVerified: true, uid: "user_9" } }),
    ),
    { outcome: "reject", code: "failed-precondition", message: "Attestation App Check requise." },
  );
});

test("un appel avec une adresse email non vérifiée est refusé à l'acceptation", () => {
  assert.deepEqual(
    decideRedemption(
      redemptionInput({ caller: { authenticated: true, appCheckAttested: true, emailVerified: false, uid: "user_9" } }),
    ),
    {
      outcome: "reject",
      code: "failed-precondition",
      message: "Une adresse email vérifiée est requise.",
    },
  );
});

test("un jeton absent ou malformé est refusé comme entrée invalide", () => {
  const invalidTokens: readonly unknown[] = [
    undefined,
    null,
    42,
    "",
    VALID_TOKEN.slice(0, 42),
    `${VALID_TOKEN}x`,
    `+${VALID_TOKEN.slice(1)}`,
    `${VALID_TOKEN.slice(0, 42)}/`,
  ];
  for (const token of invalidTokens) {
    assert.deepEqual(
      decideRedemption(redemptionInput({ rawToken: token })),
      { outcome: "reject", code: "invalid-argument", message: "token est invalide." },
    );
  }
});

test("un jeton inconnu est refusé sans fuir la moindre information", () => {
  assert.deepEqual(
    decideRedemption(redemptionInput({ invite: { exists: false, householdId: undefined, status: undefined, useCount: undefined, redeemedBy: undefined, expiresAtMs: undefined, revokedAt: undefined } })),
    {
      outcome: "reject",
      code: "permission-denied",
      message: "Cette invitation est invalide ou indisponible.",
    },
  );
});

test("un jeton expiré, y compris à la seconde exacte, est refusé", () => {
  assert.deepEqual(
    decideRedemption(redemptionInput({ invite: { exists: true, householdId: "household_b", status: "active", useCount: 0, redeemedBy: null, expiresAtMs: NOW - 1, revokedAt: null } })),
    {
      outcome: "reject",
      code: "permission-denied",
      message: "Cette invitation est invalide ou indisponible.",
    },
  );
  assert.equal(
    decideRedemption(
      redemptionInput({ invite: { exists: true, householdId: "household_b", status: "active", useCount: 0, redeemedBy: null, expiresAtMs: NOW, revokedAt: null } }),
    ).outcome,
    "reject",
  );
});

test("une expiration illisible est refusée sans coercion", () => {
  for (const expiresAtMs of [null, "bientôt", Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(
      decideRedemption(
        redemptionInput({ invite: { exists: true, householdId: "household_b", status: "active", useCount: 0, redeemedBy: null, expiresAtMs, revokedAt: null } }),
      ).outcome,
      "reject",
    );
  }
});

test("une invitation consommée, révoquée ou au statut inconnu est refusée", () => {
  const consumedInvites: readonly InviteRedemptionInput["invite"][] = [
    { exists: true, householdId: "household_b", status: "redeemed", useCount: 1, redeemedBy: "user_8", expiresAtMs: NOW + HOUR_MS, revokedAt: null },
    { exists: true, householdId: "household_b", status: "revoked", useCount: 0, redeemedBy: null, expiresAtMs: NOW + HOUR_MS, revokedAt: NOW - 1 },
    { exists: true, householdId: "household_b", status: "active", useCount: 1, redeemedBy: "user_8", expiresAtMs: NOW + HOUR_MS, revokedAt: null },
    { exists: true, householdId: "household_b", status: "active", useCount: "0", redeemedBy: null, expiresAtMs: NOW + HOUR_MS, revokedAt: null },
    { exists: true, householdId: "household_b", status: undefined, useCount: 0, redeemedBy: null, expiresAtMs: NOW + HOUR_MS, revokedAt: null },
    { exists: true, householdId: "household_b", status: "active", useCount: 0, redeemedBy: null, expiresAtMs: NOW + HOUR_MS, revokedAt: 0 },
  ];
  for (const invite of consumedInvites) {
    assert.deepEqual(
      decideRedemption(redemptionInput({ invite })),
      {
        outcome: "reject",
        code: "permission-denied",
        message: "Cette invitation est invalide ou indisponible.",
      },
    );
  }
});

test("un identifiant de foyer stocké illisible est indisponible ; corrompu il échoue fermé", () => {
  for (const householdId of [undefined, null, 42]) {
    assert.deepEqual(
      decideRedemption(
        redemptionInput({ invite: { exists: true, householdId, status: "active", useCount: 0, redeemedBy: null, expiresAtMs: NOW + HOUR_MS, revokedAt: null } }),
      ),
      {
        outcome: "reject",
        code: "permission-denied",
        message: "Cette invitation est invalide ou indisponible.",
      },
    );
  }
  for (const householdId of ["bad id!", "__dunder__", "a".repeat(129), "a\nb"]) {
    assert.deepEqual(
      decideRedemption(
        redemptionInput({ invite: { exists: true, householdId, status: "active", useCount: 0, redeemedBy: null, expiresAtMs: NOW + HOUR_MS, revokedAt: null } }),
      ),
      { outcome: "fail_closed", reason: "invalid_invite_record" },
    );
  }
});

test("le foyer désigné par l'invitation doit exister", () => {
  assert.deepEqual(
    decideRedemption(redemptionInput({ householdExists: false })),
    {
      outcome: "reject",
      code: "permission-denied",
      message: "Cette invitation est invalide ou indisponible.",
    },
  );
});

test("une double acceptation par le même membre rejoue sans nouvelle écriture", () => {
  assert.deepEqual(
    decideRedemption(
      redemptionInput({
        invite: { exists: true, householdId: "household_b", status: "redeemed", useCount: 1, redeemedBy: "user_9", expiresAtMs: NOW + HOUR_MS, revokedAt: null },
        membershipStatus: "active",
      }),
    ),
    { outcome: "replay", householdId: "household_b", alreadyMember: true },
  );
});

test("le rejeu s'impose même sur une invitation expirée déjà consommée par le membre", () => {
  // L'ordre des portes est verrouillé : la rejeu-idempotence précède la
  // relecture des validités pour le membre déjà rattaché.
  assert.deepEqual(
    decideRedemption(
      redemptionInput({
        invite: { exists: true, householdId: "household_b", status: "redeemed", useCount: 1, redeemedBy: "user_9", expiresAtMs: NOW - HOUR_MS, revokedAt: null },
        membershipStatus: "active",
      }),
    ),
    { outcome: "replay", householdId: "household_b", alreadyMember: true },
  );
});

test("la porte d'adhésion précède le rejeu : exclu du foyer, aucun service", () => {
  // La clé a bien été consommée par user_9, mais son adhésion a été retirée
  // entre-temps : le rejeu ne rend rien, la validité refuse ensuite.
  assert.deepEqual(
    decideRedemption(
      redemptionInput({
        invite: { exists: true, householdId: "household_b", status: "redeemed", useCount: 1, redeemedBy: "user_9", expiresAtMs: NOW + HOUR_MS, revokedAt: null },
        membershipStatus: "removed",
      }),
    ),
    {
      outcome: "reject",
      code: "permission-denied",
      message: "Cette invitation est invalide ou indisponible.",
    },
  );
});

test("une seconde personne ne peut pas consommer une invitation déjà utilisée", () => {
  assert.deepEqual(
    decideRedemption(
      redemptionInput({
        caller: { authenticated: true, appCheckAttested: true, emailVerified: true, uid: "user_10" },
        invite: { exists: true, householdId: "household_b", status: "redeemed", useCount: 1, redeemedBy: "user_9", expiresAtMs: NOW + HOUR_MS, revokedAt: null },
      }),
    ),
    {
      outcome: "reject",
      code: "permission-denied",
      message: "Cette invitation est invalide ou indisponible.",
    },
  );
});

test("l'isolation entre deux foyers : la cible vient du document et la capacité du foyer ciblé", () => {
  // user_9 est propriétaire du foyer A (espace) ; l'invitation désigne le
  // foyer B plein : la décision vise toujours B et refuse selon LA capacité
  // de B, jamais celle de A ni une valeur cliente.
  const fullHouseholdB = {
    capacity: { status: "available" as const, memberLimit: 2, standardMemberLimitExceeded: false },
    householdMemberCount: 2,
  };
  const decision = decideRedemption(
    redemptionInput({
      ...fullHouseholdB,
      membershipStatus: undefined,
    }),
  );
  assert.deepEqual(decision, {
    outcome: "reject",
    code: "failed-precondition",
    message: "Ce foyer doit utiliser le plan Pro avant d'ajouter un membre.",
  });

  // Une place libérée dans B : l'acceptation rattache bien à B.
  assert.deepEqual(
    decideRedemption(
      redemptionInput({
        capacity: { status: "available", memberLimit: 2, standardMemberLimitExceeded: false },
        householdMemberCount: 1,
      }),
    ),
    { outcome: "accept", householdId: "household_b", assignedRole: "member" },
  );
});

test("un membre actif existant rattache son invitation sans doubler le compteur", () => {
  // Parité historique : un membre déjà actif n'est pas soumis à la limite,
  // l'invitation est marquée consommée et aucun compteur n'est incrémenté.
  assert.deepEqual(
    decideRedemption(
      redemptionInput({
        membershipStatus: "active",
        capacity: { status: "available", memberLimit: 2, standardMemberLimitExceeded: true },
        householdMemberCount: 9,
      }),
    ),
    { outcome: "accept", householdId: "household_b", assignedRole: "member" },
  );
});

test("une composition de foyer illisible à l'acceptation échoue fermée", () => {
  for (const householdMemberCount of [undefined, "2", 0, 101, 2.5]) {
    assert.deepEqual(
      decideRedemption(redemptionInput({ householdMemberCount })),
      { outcome: "fail_closed", reason: "invalid_household_state" },
    );
  }
  assert.deepEqual(
    decideRedemption(redemptionInput({ capacity: { status: "billing_unavailable" } })),
    { outcome: "fail_closed", reason: "billing_unavailable" },
  );
});

test("une enveloppe de requête serveur invalide échoue fermée à l'acceptation", () => {
  for (const nowMs of [Number.NaN, 1.5, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(
      decideRedemption(redemptionInput({ nowMs })),
      { outcome: "fail_closed", reason: "invalid_request_envelope" },
    );
  }
});

test("la capacité n'est consultée qu'après les portes de validité", () => {
  // Invitation expirée alors que la facturation est indisponible : le refus
  // de validité s'applique sans que l'état de facturation n'influence la
  // décision — la seconde phase n'est jamais atteinte.
  assert.deepEqual(
    decideRedemption(
      redemptionInput({
        invite: { exists: true, householdId: "household_b", status: "active", useCount: 0, redeemedBy: null, expiresAtMs: NOW - 1, revokedAt: null },
        capacity: { status: "billing_unavailable" },
      }),
    ),
    {
      outcome: "reject",
      code: "permission-denied",
      message: "Cette invitation est invalide ou indisponible.",
    },
  );
  // De même pour une invitation déjà consommée par autrui.
  assert.deepEqual(
    decideRedemption(
      redemptionInput({
        invite: { exists: true, householdId: "household_b", status: "redeemed", useCount: 1, redeemedBy: "user_8", expiresAtMs: NOW + HOUR_MS, revokedAt: null },
        capacity: { status: "billing_unavailable" },
      }),
    ),
    {
      outcome: "reject",
      code: "permission-denied",
      message: "Cette invitation est invalide ou indisponible.",
    },
  );
});

// --- Observation réelle de l'identité (constat F1) ---------------------------
//
// Le câblage transmet désormais à la décision la requête brute via
// `observedCaller` : les tests ci-dessous empruntent exactement le
// même chemin que la production (requête → observation → décision) afin de
// prouver qu'une identité dégradée est refusée par le module pur lui-même,
// pas seulement par les gardes amont.

interface ObservedRequestShape {
  uid?: string | undefined;
  appCheck?: boolean | undefined;
  emailVerified?: unknown;
}

/** Requête appelable réduite aux champs observés, comme `CallableRequest`. */
function observedRequest(fields: ObservedRequestShape): ObservedCallableRequest {
  return {
    ...(fields.uid === undefined
      ? {}
      : { auth: { uid: fields.uid, token: { email_verified: fields.emailVerified } } }),
    ...(fields.appCheck === true ? { app: { appId: "app_check_attested" } } : {}),
  };
}

test("l'observation reflète exactement la requête reçue, sans constante", () => {
  assert.deepEqual(
    observedCaller(
      observedRequest({ uid: "user_1", appCheck: true, emailVerified: true }),
    ),
    { authenticated: true, appCheckAttested: true, emailVerified: true, uid: "user_1" },
  );
  // Sans Authentification : aucune porte n'est supposée acquise.
  assert.deepEqual(observedCaller(observedRequest({})), {
    authenticated: false,
    appCheckAttested: false,
    emailVerified: false,
    uid: undefined,
  });
  // Authentifié mais sans attestation App Check : seule cette porte tombe.
  assert.deepEqual(
    observedCaller(observedRequest({ uid: "user_1", emailVerified: true })),
    { authenticated: true, appCheckAttested: false, emailVerified: true, uid: "user_1" },
  );
});

test("une identité dégradée observée est refusée par la décision de création", () => {
  // Requête sans Authentification : la porte du module pur s'exécute avec le
  // code et le message historiques, avant toute lecture d'adhésion ou de
  // capacité — alors même que toutes les autres entrées seraient valides.
  assert.deepEqual(
    decideInviteCreation(
      creationInput({ caller: observedCaller(observedRequest({})) }),
    ),
    { outcome: "reject", code: "unauthenticated", message: "Authentification requise." },
  );
  // Authentifié sans attestation App Check.
  assert.deepEqual(
    decideInviteCreation(
      creationInput({
        caller: observedCaller(observedRequest({ uid: "user_1", emailVerified: true })),
      }),
    ),
    {
      outcome: "reject",
      code: "failed-precondition",
      message: "Attestation App Check requise.",
    },
  );
  // Email non vérifié : la valeur traverse une frontière et doit être
  // strictement `true`, jamais coercée.
  for (const flag of [false, undefined, "yes", 1]) {
    assert.deepEqual(
      decideInviteCreation(
        creationInput({
          caller: observedCaller(
            observedRequest({ uid: "user_1", appCheck: true, emailVerified: flag }),
          ),
        }),
      ),
      {
        outcome: "reject",
        code: "failed-precondition",
        message: "Une adresse email vérifiée est requise.",
      },
    );
  }
  // Identifiant d'utilisateur vide : refusé comme non authentifié.
  assert.deepEqual(
    decideInviteCreation(
      creationInput({
        caller: observedCaller(
          observedRequest({ uid: "", appCheck: true, emailVerified: true }),
        ),
      }),
    ),
    { outcome: "reject", code: "unauthenticated", message: "Authentification requise." },
  );
});

test("une identité pleinement attestée observée conserve l'acceptation historique", () => {
  const attested = observedCaller(
    observedRequest({ uid: "user_1", appCheck: true, emailVerified: true }),
  );
  assert.deepEqual(decideInviteCreation(creationInput({ caller: attested })), {
    outcome: "accept",
    expiresAtMs: NOW + 24 * HOUR_MS,
  });
});

test("une identité dégradée observée est refusée à l'acceptation, avant même le rejeu", () => {
  // Invitation déjà consommée par user_9, toujours membre actif : avec un
  // câblage à constantes, une requête dégradée aurait pu atteindre la branche
  // de rejeu ; l'observation réelle arrête la requête à la porte d'identité.
  assert.deepEqual(
    decideRedemption(
      redemptionInput({
        caller: observedCaller(observedRequest({})),
        invite: {
          exists: true,
          householdId: "household_b",
          status: "redeemed",
          useCount: 1,
          redeemedBy: "user_9",
          expiresAtMs: NOW - HOUR_MS,
          revokedAt: null,
        },
        membershipStatus: "active",
      }),
    ),
    { outcome: "reject", code: "unauthenticated", message: "Authentification requise." },
  );
  // Authentifié sans attestation App Check.
  assert.deepEqual(
    decideRedemption(
      redemptionInput({
        caller: observedCaller(
          observedRequest({ uid: "user_9", emailVerified: true }),
        ),
      }),
    ),
    {
      outcome: "reject",
      code: "failed-precondition",
      message: "Attestation App Check requise.",
    },
  );
  // Email non vérifié, y compris sans coercion d'une valeur non booléenne.
  for (const flag of [false, undefined, "yes"]) {
    assert.deepEqual(
      decideRedemption(
        redemptionInput({
          caller: observedCaller(
            observedRequest({ uid: "user_9", appCheck: true, emailVerified: flag }),
          ),
        }),
      ),
      {
        outcome: "reject",
        code: "failed-precondition",
        message: "Une adresse email vérifiée est requise.",
      },
    );
  }
});

test("une identité pleinement attestée observée conserve l'acceptation à l'arrivée", () => {
  const attested = redemptionInput({
    caller: observedCaller(
      observedRequest({ uid: "user_9", appCheck: true, emailVerified: true }),
    ),
  });
  assert.deepEqual(decideRedemption(attested), {
    outcome: "accept",
    householdId: "household_b",
    assignedRole: "member",
  });
});

// --- Jeton : entropie, borne, condensé --------------------------------------

test("le jeton généré respecte l'entropie annoncée et la forme canonique", () => {
  assert.ok(inviteTokenEntropyBits() >= MIN_INVITE_TOKEN_ENTROPY_BITS);
  const samples = 50;
  const unique = new Set<string>();
  for (let index = 0; index < samples; index += 1) {
    const token = createOpaqueInviteToken();
    assert.equal(isValidInviteTokenShape(token), true, `forme invalide : ${token.length}`);
    unique.add(token);
  }
  assert.equal(unique.size, samples);
});

test("le condensé stocké est déterministe et ne révèle pas la matière brute", () => {
  // Vecteur connu de SHA-256 : la dérivation ne change jamais silencieusement.
  assert.equal(
    inviteDigest("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  const digest = inviteDigest(VALID_TOKEN);
  assert.match(digest, /^[0-9a-f]{64}$/u);
  assert.equal(inviteDigest(VALID_TOKEN), digest);
  assert.notEqual(digest, VALID_TOKEN);
  assert.notEqual(inviteDigest(`${VALID_TOKEN}x`), digest);
});

test("la forme canonique borne strictement le jeton accepté", () => {
  assert.equal(isValidInviteTokenShape("A".repeat(43)), true);
  assert.equal(isValidInviteTokenShape(`${"-".repeat(21)}_${"-".repeat(21)}`), true);
  for (const value of ["A".repeat(42), "A".repeat(44), "", "+/+/+/+/+/+/+/+/+/+/+/+/+/+/+/+/+/+/+/+/", 42, null, undefined]) {
    assert.equal(isValidInviteTokenShape(value), false);
  }
});

test("l'identifiant de foyer stocké suit les mêmes règles que l'entrée validée", () => {
  assert.equal(isValidStoredHouseholdId("household_b"), true);
  assert.equal(isValidStoredHouseholdId("a".repeat(128)), true);
  for (const value of [undefined, null, 42, "", "bad id!", "__dunder__", "a".repeat(129), "a\nb"]) {
    assert.equal(isValidStoredHouseholdId(value), false);
  }
});
