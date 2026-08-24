import { CallableRequest, HttpsError } from "firebase-functions/v2/https";

export interface CallerIdentity {
  readonly uid: string;
  readonly displayName: string;
}

/**
 * Vérifie l'identité de l'appelant en logique pure : Auth obligatoire,
 * attestation App Check obligatoire, adresse email vérifiée obligatoire.
 * Le client est non fiable : aucune autre valeur reçue n'est utilisée pour
 * décider d'une autorisation.
 */
export function requireCaller(request: CallableRequest<unknown>): CallerIdentity {
  if (request.auth === undefined) {
    throw new HttpsError("unauthenticated", "Authentification requise.");
  }
  if (request.app === undefined) {
    throw new HttpsError("failed-precondition", "Attestation App Check requise.");
  }
  if (request.auth.token.email_verified !== true) {
    throw new HttpsError(
      "failed-precondition",
      "Une adresse email vérifiée est requise.",
    );
  }

  const rawName = request.auth.token.name;
  const displayName =
    typeof rawName === "string" && rawName.trim().length > 0
      ? rawName.normalize("NFC").trim().slice(0, 80)
      : "Membre";

  return { uid: request.auth.uid, displayName };
}
