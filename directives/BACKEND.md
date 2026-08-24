# Runner backend/sécurité — directive active

Autorité : directeur ChoreScore, sous réserve de `MAIN_PROMPT.md`.

## État actuel (après cycle 32692689814)

**93/93 tests Functions passent**, 0 ignoré, sans émulateur. Ont été intégrés
et audités ce cycle (`7c39e4f`, audit round 1 `accept`, aucun repair demandé) :

- `functions/src/invitations.ts` : module pur (aucun SDK Firestore, aucun
  réseau) des décisions d'autorisation des invitations — création et
  acceptation en deux phases à capacité différée ; jeton 256 bits borné à 43
  caractères base64url, condensat SHA-256 seul stocké (`inviteDigest`), rôle
  attribué figé à `member`, cible issue du document stocké, rejeu idempotent
  sans écriture, échecs fermés sans coercion ;
- `functions/src/invites.ts` réécrit en câblage mince ; parité d'erreur
  vérifiée porte par porte (codes et messages historiques conservés, erreurs
  de facturation relancées telles quelles) ;
- 36 tests négatifs nouveaux dont isolation entre deux foyers.

Hérités : `decideTaskCompletion`, gardes Stripe composées,
`callerIdentity.ts`. `STRIPE_ENABLED`, `STRIPE_LIVE_MODE`,
`ANALYTICS_AGGREGATION_ENABLED` restent fermés. Les règles Firestore restent
en quarantaine.

## Mission prioritaire — une seule tranche bornée

**Résoudre le constat F1 de l'audit (`F1-identite-decorative-cablage`, faible)
par le code**, pas seulement par consignation :

1. Transmettre aux décisions pures `decideInviteCreation` et
   `decideInviteRedemption` les valeurs **réellement observées** de la requête
   (par exemple `request.auth !== undefined`, `request.app !== undefined`,
   `request.auth?.token.email_verified === true`) au lieu des constantes
   `true` actuelles, afin que les portes d'identité du module pur redeviennent
   des défenses exécutables et pas seulement décoratives.
2. Conserver la parité d'erreur porte par porte : aucune nouvelle erreur
   observable, aucun message modifié.
3. Tests négatifs nouveaux prouvant qu'une identité dégradée transmise au
   câblage est bien refusée par la décision pure (et pas seulement par les
   gardes amont).

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
- Toute modification future de `requireCaller` exige une revue croisée avec
  `invitations.ts` tant que des portes d'identité y restent alimentées par des
  constantes (levée si la mission ci-dessus est réalisée).

## Preuves attendues

- diff limité à `functions/src/**` + `functions/test/**`, lockfiles intacts ;
- tests négatifs nouveaux (succès et refus), 0 test ignoré ;
- `npm --prefix functions run check` vert ;
- `npm --prefix functions audit --omit=dev --audit-level=high` exit 0 ;
- liste exacte de ce qui reste non prouvé sans émulateur.
