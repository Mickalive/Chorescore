# Runner backend/sécurité — directive active

Autorité : directeur ChoreScore, sous réserve de `MAIN_PROMPT.md`.

## État actuel (après cycle 32781937768)

**98/98 tests Functions passent**, 0 ignoré, sans émulateur. Ont été intégrés
et audités ce cycle (`46fb523`, audit round 1 `accept`, aucun repair demandé) :

- `functions/src/invitations.ts` : `observedInviteCaller(request)` observe
  `auth`/`app`/`token.email_verified`/`uid` sur la requête brute (interface
  `ObservedCallableRequest` structurellement compatible avec le SDK, module
  toujours pur et sans réseau) ; aucune valeur cliente lue ;
- `functions/src/invites.ts` : les deux décisions reçoivent désormais
  l'identité réellement observée au lieu des constantes `true`
  (constat F1-identite-decorative-cablage résolu par le code) ;
  `redeemInvite` transmet aussi `exists: inviteSnapshot.exists` ; parité
  d'erreur porte par porte conservée ;
- 5 tests nouveaux composant requête → observation → décision : identité
  dégradée refusée avant même la branche de rejeu, `email_verified` strict
  sans coercion (`false`/`undefined`/"yes"/1), acceptation historique
  conservée à identité pleinement attestée.

Hérités : `decideTaskCompletion`, gardes Stripe composées,
`callerIdentity.ts`. `STRIPE_ENABLED`, `STRIPE_LIVE_MODE`,
`ANALYTICS_AGGREGATION_ENABLED` restent fermés. Les règles Firestore restent
en quarantaine.

## Mission prioritaire — une seule tranche bornée

**Épingler la vérité du câblage d'identité et la généraliser**, en répondant
aux deux constats de l'audit round 1 :

1. **F1-cablage-observe-non-epingle (faible)** — si `invites.ts` revenait aux
   constantes `{authenticated:true, appCheckAttested:true, emailVerified:true}`,
   les 98 tests continueraient de passer. Épingler le câblage sans émulateur,
   au choix : un test d'assertion de source vérifiant qu'aucun littéral
   `authenticated: true` n'alimente plus les décisions dans
   `functions/src/invites.ts` et que `observedInviteCaller(request)` y est
   appelé pour `createInvite` **et** `redeemInvite`, ou l'extraction d'une
   fonction de composition pure (requête + entrées transaction → décision)
   utilisée par le câblage et testée directement.
2. **F2-constantes-identite-tasks (info)** — `completeTask` transmet encore
   des booléens d'identité constants à `decideTaskCompletion` (~ligne 300).
   Généraliser l'extracteur observé (par exemple renommé `observedCaller`) et
   l'appliquer à `completeTask` comme aux invitations, avec tests négatifs de
   la même famille (identité dégradée refusée par la décision via
   l'observation réelle).

Vérifications exigées : `npm --prefix functions run check` vert après
correction, et échec démontré du nouveau test d'épinglage en simulant un
retour aux constantes dans `invites.ts` (revert local puis passage du test en
rouge). Aucune nouvelle erreur observable, aucun message modifié.

S'interdire : recréer les règles quarantainées, toucher le client mobile,
modifier les gardes Stripe intégrées sauf défaut prouvé par test, affaiblir
`requireCaller`/`requireActiveMembershipInTransaction`.

## Résidus consignés (prérequis pré-Stripe / pré-émulateur uniquement)

- **F2-concurrence-sans-emulateur (info)** : la course de double acceptation
  n'est verrouillée que par les transactions Firestore ; un test d'émulateur
  de double acceptation concurrente (deux utilisateurs, dont un entre deux
  foyers) reste exigé avant toute production — il attend un incrément
  disposant réellement de l'émulateur local.
- Départage des événements Stripe de même seconde (C2/B1), repli
  `customer.subscription.deleted` (B7), uniformisation des documents
  `stripeEvents/{id}` et test de borne d'identifiant > 256 (B4/B5).
- La note du cycle précédent sur `requireCaller` est levée pour les
  invitations (portes alimentées par l'observation) ; elle reste valable pour
  `tasks.ts` jusqu'à la mission ci-dessus.

## Preuves attendues

- diff limité à `functions/src/**` + `functions/test/**`, lockfiles intacts ;
- tests négatifs nouveaux (succès et refus), 0 test ignoré ;
- démonstration rouge→vert du test d'épinglage du câblage ;
- `npm --prefix functions run check` vert ;
- `npm --prefix functions audit --omit=dev --audit-level=high` exit 0 ;
- liste exacte de ce qui reste non prouvé sans émulateur.
