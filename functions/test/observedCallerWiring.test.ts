import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";
import path from "node:path";

import { observedCaller } from "../src/observedCaller";

/**
 * Épinglage du câblage d'identité observée (constat
 * F1-cablage-observe-non-epingle, BE-C4-F1).
 *
 * Les décisions pures sont testées ailleurs ; ce fichier verrouille le CÂBLAGE :
 * createInvite, redeemInvite et completeTask doivent alimenter leurs décisions
 * avec `observedCaller(request)` — la requête brute, jamais un objet constant.
 *
 * Les handlers appelables exigent l'émulateur Firestore pour s'exécuter bout
 * en bout (incrément reporté, constat F2-concurrence-sans-emulateur) : le
 * câblage est donc épinglé par assertion sur la source compilable, selon la
 * voie proposée par l'audit. Toute régression vers des constantes
 * `{authenticated: true, appCheckAttested: true, emailVerified: true}` ou tout
 * arrêt de lecture de la requête fait échouer ces tests.
 *
 * Un renommage légitime du paramètre de requête ou de l'extracteur doit mettre
 * à jour cet épinglage consciemment, pas silencieusement.
 */

// Les tests sont compilés dans lib/test/ ; les sources restent dans src/.
const SRC_DIR = path.resolve(__dirname, "..", "..", "src");

function sourceOf(fileName: string): string {
  return readFileSync(path.join(SRC_DIR, fileName), "utf8");
}

/** Littéral d'identité constante : la forme exacte de l'ancien câblage. */
const IDENTITY_LITERAL_PATTERN =
  /(authenticated|appCheckAttested|emailVerified):\s*true/u;

/**
 * Forme structurelle du câblage épinglé : l'identité transmise à la décision
 * vient de l'observation de la requête brute. Cibler `caller:` évite tout
 * faux positif sur les commentaires qui documentent l'extracteur.
 */
const WIRING_PATTERN = /caller:\s*observedCaller\(request\)/gu;

test("createInvite et redeemInvite alimentent leurs décisions avec observedCaller(request)", () => {
  const source = sourceOf("invites.ts");
  const callSites = source.match(WIRING_PATTERN) ?? [];
  assert.equal(
    callSites.length,
    2,
    "invites.ts doit alimenter exactement deux décisions avec caller: observedCaller(request) — createInvite et redeemInvite. Un retour à des constantes d'identité ou un arrêt de lecture de la requête est détecté ici.",
  );
  assert.equal(
    IDENTITY_LITERAL_PATTERN.test(source),
    false,
    "invites.ts ne doit plus contenir aucun littéral d'identité constante (authenticated/appCheckAttested/emailVerified à true) : les portes doivent rester exécutables depuis la requête brute.",
  );
  assert.match(
    source,
    /from "\.\/observedCaller"/u,
    "invites.ts doit importer l'extracteur observé partagé.",
  );
});

test("completeTask alimente sa décision avec observedCaller(request)", () => {
  const source = sourceOf("tasks.ts");
  const callSites = source.match(WIRING_PATTERN) ?? [];
  assert.equal(
    callSites.length,
    1,
    "tasks.ts doit alimenter exactement une décision avec caller: observedCaller(request) dans completeTask (constat F2-constantes-identite-tasks). Un retour aux booléens constants est détecté ici.",
  );
  assert.equal(
    IDENTITY_LITERAL_PATTERN.test(source),
    false,
    "tasks.ts ne doit plus contenir aucun littéral d'identité constante : l'autorisation s'appuie sur l'identité observée côté serveur.",
  );
  assert.match(
    source,
    /from "\.\/observedCaller"/u,
    "tasks.ts doit importer l'extracteur observé partagé.",
  );
});

test("observedCaller reflète la requête reçue : aucune porte supposée acquise", () => {
  // Mode « extracteur redevenu constant » : si observedCaller cessait de lire
  // la requête pour retourner des constantes, cette assertion échoue.
  assert.deepEqual(observedCaller({}), {
    authenticated: false,
    appCheckAttested: false,
    emailVerified: false,
    uid: undefined,
  });
  assert.deepEqual(
    observedCaller({
      auth: { uid: "user_1", token: { email_verified: true } },
      app: { appId: "app_check_attested" },
    }),
    {
      authenticated: true,
      appCheckAttested: true,
      emailVerified: true,
      uid: "user_1",
    },
  );
});
