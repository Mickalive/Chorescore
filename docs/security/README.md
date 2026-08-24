# État sécurité du backend

Le dossier `functions/` est un **socle de développement**, pas un backend prêt à déployer. Il compile et ses règles métier pures sont testées, mais aucun environnement Firebase ou Stripe n'est configuré dans ce dépôt.

Avant tout déploiement, la boucle doit livrer et faire relire :

- des règles Firestore et Storage en refus par défaut, avec tests d'émulateur inter-foyers ;
- la configuration Firebase, App Check et les politiques de rétention/TTL ;
- des tests d'intégration des fonctions appelables, de concurrence et d'idempotence ;
- la vérification complète du webhook Stripe en environnement de test ;
- les parcours d'export, suppression et révocation du consentement ;
- une revue humaine indépendante et un test d'intrusion.

`STRIPE_ENABLED`, `STRIPE_LIVE_MODE` et `ANALYTICS_AGGREGATION_ENABLED` restent à `false` par défaut. Les secrets ne doivent être fournis qu'au runtime des Functions via le gestionnaire de secrets.

## Invariants appliqués et testés en logique pure

### Ordre des événements d'abonnement Stripe

Conformément à l'architecture (aucun événement ancien ne peut écraser un état
d'abonnement plus récent), la décision d'ordre est isolée dans
[`functions/src/billingOrder.ts`](../../functions/src/billingOrder.ts) et
appliquée à l'intérieur de la transaction du webhook
(`applySubscriptionState` dans `functions/src/billing.ts`) :

- rejeu exact : un événement dont l'identifiant correspond au dernier état
  appliqué est enregistré comme doublon sans toucher au billing ni au foyer ;
- événement désordonné ou tardif : un événement dont l'horodatage Stripe
  `created` est strictement antérieur au marqueur `lastStripeEventCreated`
  est refusé (`stale_event`) et journalisé dans `stripeEvents/{id}` sans
  modification d'état ;
- enveloppe invalide (identifiant vide/trop long, horodatage non entier,
  négatif ou non fini) : échec fermé (`invalid_event_envelope`), jamais
  appliqué ;
- premier événement sans historique : appliqué ; un marqueur corrompu (non
  numérique) est ignoré de façon déterministe et la protection retombe alors
  sur la déduplication par identifiant — comportement documenté, à revoir si
  une corruption réelle était observée.

Les tests négatifs correspondants se trouvent dans
`functions/test/billingOrder.test.ts`.

### Application des événements entre abonnements (seconde garde)

Une seconde garde, [`decideSubscriptionEventApplication` dans
`functions/src/domain.ts`](../../functions/src/domain.ts), complète la décision
d'ordre à l'intérieur de la même transaction, après le contrôle de cohérence
client Stripe :

- un état de facturation stocké comportant un champ d'ordre présent mais
  illisible (`stripeSubscriptionId`, `lastStripeEventCreated`, `paidTier`,
  `stripeCurrentPeriodEnd`, `stripeStatus`) est rejeté en échec fermé
  (`billing_state_unparseable`) plutôt qu'appliqué sans protection — le
  prédicat est isolé dans `storedBillingStateIsUnreadable`
  (`functions/src/billingOrder.ts`) et testé hors SDK ;
- un événement non vivant portant sur un abonnement différent de celui suivi
  est ignoré (`superseded_subscription_terminal`) ;
- une bascule vers un abonnement vivant qui rétrograderait le niveau connu,
  ou d'un rang inconnu tant que l'accès suivi est courant, est refusée
  (`superseded_subscription_live`) ; la reprise après expiration reste
  possible.

Tests : `functions/test/billing.test.ts` (décision d'application + signature
webhook en crypto locale).

### Identité de l'appelant

`requireCaller` (extrait dans [`functions/src/callerIdentity.ts`](../../functions/src/callerIdentity.ts))
refuse tout appel sans Authentification Firebase, sans attestation App Check
ou avec une adresse email non vérifiée ; le nom affiché est normalisé,
borné à 80 caractères et neutre par défaut. Tests négatifs :
`functions/test/caller.test.ts`.

## Contrôles exécutés lors du dernier cycle backend

Mis à jour par le directeur, cycle `32684730787` (intégration des candidats
audités 32680607423 backend et 32675726760-1 backend, plus correction C1) :

- `npm --prefix functions run check` : typage strict + **37/37 tests unitaires
  purs passants, 0 ignoré** (ordre et application des événements Stripe,
  échec fermé sur état illisible, identité appelant, domaine, validation) ;
- `npm --prefix functions audit --omit=dev --audit-level=high` : exit 0,
  7 avis modérés préexistants (chaîne `firebase-admin → uuid`), sous le seuil ;
- aucun secret, aucun appel réseau, aucune donnée personnelle dans les tests ;
  le secret de test `whsec_local_unit_test_only` est factice et réservé aux
  tests.

## Contrôles encore bloqués (non prouvés)

- exécution réelle des règles Firestore/Storage sur émulateur, y compris tests
  d'isolation inter-foyers : bloquée faute d'émulateur dans le cycle ; le
  candidat de règles précédent reste en quarantaine ;
- signature de webhook vérifiée de bout en bout contre Stripe en mode test,
  concurrence réelle multi-instances et idempotence sous charge : nécessitent
  un environnement d'intégration ;
- adhésion, rôle, idempotence et concurrence des fonctions appelables sur
  Firestore réel : logique présente mais non exécutée hors émulateur ;
- rétention, suppression, export et TTL : conception restante avant données
  réelles.

Le suivi prioritaire se trouve dans [`../NEXT_CYCLE.md`](../NEXT_CYCLE.md).
