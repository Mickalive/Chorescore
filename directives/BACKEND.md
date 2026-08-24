# Runner backend/sécurité — directive active

Autorité : directeur ChoreScore, sous réserve de `MAIN_PROMPT.md`.

## État actuel (après cycle 32684730787)

**37/37 tests Functions passent**, 0 ignoré, sans émulateur. Ont été intégrés
et audités :

- garde d'ordre legacy : `decideSubscriptionEventOrder`
  (`functions/src/billingOrder.ts`) — enveloppe validée en échec fermé,
  rejeu exact → doublon, événement antérieur au marqueur → `stale_event` ;
- garde d'application récupérée : `decideSubscriptionEventApplication`
  (`functions/src/domain.ts`) — résiliation d'un abonnement remplacé ignorée,
  bascule vivant→vivant refusée si elle rétrograde le niveau ou si le rang est
  inconnu tant que l'accès suivi est courant ;
- échec fermé sur état de facturation illisible via
  `storedBillingStateIsUnreadable` (y compris `stripeStatus` non textuel,
  correction C1) ;
- identité appelant extraite (`callerIdentity.ts`), tests négatifs
  Auth/App Check/email vérifié/nom borné.

Les deux gardes sont composées dans la transaction de `applySubscriptionState`.
`STRIPE_ENABLED`, `STRIPE_LIVE_MODE`, `ANALYTICS_AGGREGATION_ENABLED` restent
fermés. Les règles Firestore restent en quarantaine (jamais recréées sans
émulateur).

## Mission prioritaire — une seule tranche bornée

Logique pure des fonctions appelables, **un seul domaine au choix** :

- **invitations** : création/acceptation — validation d'entrée, entropie et
  borne du jeton, expiration, rôle attribué, appartenance au foyer ; ou
- **completion de tâches** : décision d'autorisation (rôle, appartenance,
  propriété de l'entrée) et idempotence de la soumission.

Extraire la décision dans un module pur (sans SDK Firestore), avec tests
négatifs couvrant au minimum : sans Auth, sans App Check, email non vérifié,
rôle insuffisant, hors foyer, entre **deux foyers** pour prouver l'isolation,
et double soumission. Aucune activation de service, aucun émulateur requis,
aucune dépendance nouvelle.

S'interdire : recréer les règles quarantainées, toucher le client mobile,
modifier les gardes Stripe intégrées sauf défaut prouvé par test.

Résidus consignés à ne pas traiter ce cycle (prérequis pré-Stripe uniquement) :
départage des événements de même seconde (C2/B1), repli
`customer.subscription.deleted` (B7), uniformisation des documents
`stripeEvents/{id}` et test de borne d'identifiant > 256 (B4/B5).

## Preuves attendues

- module(s) purs + tests négatifs nouveaux (succès et refus) ;
- `npm --prefix functions run check` vert, 0 test ignoré ;
- `npm --prefix functions audit --omit=dev --audit-level=high` exit 0 ;
- liste exacte de ce qui reste non prouvé sans émulateur.
