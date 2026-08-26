/**
 * Observation de l'identité d'un appelant sur la requête brute d'une fonction
 * appelable, en logique pure et sans dépendance SDK.
 *
 * Invariants constitutionnels (MAIN_PROMPT.md §7 et §9) :
 * - le client est non fiable : `auth`, `app` et `token` sont posés par la
 *   plateforme après vérification, jamais lus dans le corps de la requête ;
 * - chaque porte reflète une propriété réellement constatée sur la requête,
 *   jamais une constante supposée acquise par les gardes amont ; si
 *   `requireCaller` venait à s'affaiblir, les portes alimentées par cette
 *   observation restent exécutables et refusent avec les codes et messages
 *   historiques (constats F1-identite-decorative-cablage puis
 *   F1-cablage-observe-non-epingle) ;
 * - `email_verified` traverse une frontière : il est comparé strictement à
 *   `true`, sans coercion.
 *
 * Ce module ne dépend ni de Firestore, ni d'Admin SDK, ni de firebase-functions
 * afin de rester testable hors émulateur et sans effet de bord. La forme
 * retournée est structurellement compatible avec `InviteCaller`
 * (invitations.ts) et `CompletionCaller` (taskCompletion.ts), qui restent les
 * types d'entrée des décisions pures.
 */

/**
 * Forme minimale d'une requête appelable nécessaire à l'observation de
 * l'identité. Structurellement compatible avec `CallableRequest` du SDK sans
 * en dépendre.
 */
export interface ObservedCallableRequest {
  readonly auth?:
    | {
        readonly uid?: unknown;
        readonly token?: { readonly email_verified?: unknown };
      }
    | undefined;
  readonly app?: unknown;
}

/** Identité observée sur la requête, re-vérifiée par les décisions pures. */
export interface ObservedCaller {
  readonly authenticated: boolean;
  readonly appCheckAttested: boolean;
  readonly emailVerified: boolean;
  readonly uid: unknown;
}

/**
 * Identité réellement observée sur la requête brute du câblage. Utilisé par
 * `createInvite`, `redeemInvite` et `completeTask` : un retour de l'un de ces
 * câblages à des constantes d'identité est détecté par
 * test/observedCallerWiring.test.ts.
 */
export function observedCaller(request: ObservedCallableRequest): ObservedCaller {
  return {
    authenticated: request.auth !== undefined,
    appCheckAttested: request.app !== undefined,
    emailVerified: request.auth?.token?.email_verified === true,
    uid: request.auth?.uid,
  };
}
