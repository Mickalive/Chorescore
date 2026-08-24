# Runner backend/sécurité — directive active

Autorité : directeur ChoreScore, sous réserve de `MAIN_PROMPT.md`.

## État actuel (après cycle 32688156479)

**57/57 tests Functions passent**, 0 ignoré, sans émulateur. Ont été intégrés
et audités ce cycle (`531f614`, audit `accepter`) :

- `decideTaskCompletion` (`functions/src/taskCompletion.ts`) : décision pure
  d'autorisation et d'idempotence de `completeTask` — identité (Auth,
  App Check, email vérifié), adhésion active et rôle connu, propriété de la
  tâche, état et début lisible, poids figé borné 1–1000, durée serveur bornée
  à 24 h ; rejeu exact sans nouvelle écriture ; enregistrement d'idempotence
  incohérent ou corrompu → échec fermé ;
- `completeTask` réécrit sur cette décision, sémantique d'erreur préservée,
  mêmes lectures transactionnelles (opération, tâche, adhésion) ;
- durcissement directeur (constat F2 de l'audit, faible) :
  `storedBillingStateIsUnreadable` échoue désormais fermé sur un
  `stripeStatus` stocké textuel mais inconnu (ex. « actif ») et sur un
  `lastStripeEventCreated` négatif ; liste canonique `ALL_STRIPE_STATUSES`
  exportée par `domain.ts` ; tests négatifs ajoutés.

Hérités des cycles précédents : gardes Stripe composées
(`decideSubscriptionEventOrder` + `decideSubscriptionEventApplication` +
`storedBillingStateIsUnreadable`), `callerIdentity.ts`. `STRIPE_ENABLED`,
`STRIPE_LIVE_MODE`, `ANALYTICS_AGGREGATION_ENABLED` restent fermés. Les règles
Firestore restent en quarantaine (jamais recréées sans émulateur).

## Mission prioritaire — une seule tranche bornée

Logique pure du domaine **invitations** : création et acceptation — validation
d'entrée, entropie et borne du jeton, condensé stocké, expiration, rôle
attribué, appartenance au foyer, double acceptation. Extraire la décision dans
un module pur (sans SDK Firestore), avec tests négatifs couvrant au minimum :
sans Auth, sans App Check, email non vérifié, jeton absent/inconnu/expiré,
rôle insuffisant, hors foyer, isolation entre **deux foyers**, et double
acceptation. Aucune activation de service, aucun émulateur requis, aucune
dépendance nouvelle.

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
- liste exacte de ce qui reste non prouvé sans émulateur (le câblage
  transactionnel de `completeTask` reste dans ce cas — constat F3).
