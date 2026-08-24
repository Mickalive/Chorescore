import assert from "node:assert/strict";
import test from "node:test";

import { CallableRequest, HttpsError } from "firebase-functions/v2/https";

import { requireCaller } from "../src/callerIdentity";

interface RequestShape {
  uid?: string | undefined;
  appCheck?: boolean | undefined;
  emailVerified?: boolean | undefined;
  name?: unknown;
}

function callableRequest(fields: RequestShape): CallableRequest<unknown> {
  const auth =
    fields.uid === undefined
      ? undefined
      : {
          uid: fields.uid,
          token: {
            email_verified: fields.emailVerified,
            name: fields.name,
          },
        };
  return {
    data: {},
    auth,
    app: fields.appCheck ? { appId: "app_check_attested" } : undefined,
    rawRequest: {},
  } as unknown as CallableRequest<unknown>;
}

function errorCode(operation: () => unknown): string {
  try {
    operation();
  } catch (error) {
    if (error instanceof HttpsError) {
      return error.code;
    }
    throw error;
  }
  throw new Error("L'opération devait être refusée.");
}

test("un appel sans Authentification Firebase est refusé", () => {
  assert.equal(
    errorCode(() => requireCaller(callableRequest({}))),
    "unauthenticated",
  );
});

test("un appel authentifié sans attestation App Check est refusé", () => {
  assert.equal(
    errorCode(() =>
      requireCaller(callableRequest({ uid: "user_1", appCheck: false, emailVerified: true })),
    ),
    "failed-precondition",
  );
});

test("un appel avec une adresse email non vérifiée est refusé", () => {
  assert.equal(
    errorCode(() =>
      requireCaller(callableRequest({ uid: "user_1", appCheck: true, emailVerified: false })),
    ),
    "failed-precondition",
  );
  assert.equal(
    errorCode(() =>
      requireCaller(callableRequest({ uid: "user_1", appCheck: true, emailVerified: undefined })),
    ),
    "failed-precondition",
  );
});

test("une identité complète est acceptée et normalisée", () => {
  const caller = requireCaller(
    callableRequest({
      uid: "user_1",
      appCheck: true,
      emailVerified: true,
      name: "  Anne-Sophie  ",
    }),
  );
  assert.deepEqual(caller, { uid: "user_1", displayName: "Anne-Sophie" });
});

test("un nom absent ou vide retombe sur une valeur neutre, jamais sur une injection", () => {
  assert.equal(
    requireCaller(
      callableRequest({ uid: "user_2", appCheck: true, emailVerified: true, name: undefined }),
    ).displayName,
    "Membre",
  );
  assert.equal(
    requireCaller(
      callableRequest({ uid: "user_2", appCheck: true, emailVerified: true, name: "   " }),
    ).displayName,
    "Membre",
  );
  assert.equal(
    requireCaller(
      callableRequest({ uid: "user_2", appCheck: true, emailVerified: true, name: 42 }),
    ).displayName,
    "Membre",
  );
});

test("un nom trop long est tronqué à 80 caractères côté serveur", () => {
  const longName = "A".repeat(200);
  const caller = requireCaller(
    callableRequest({ uid: "user_3", appCheck: true, emailVerified: true, name: longName }),
  );
  assert.equal(caller.displayName.length, 80);
});
