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

Le client est traité comme hostile : l'identité n'est jamais lue dans le corps
de la requête, elle est constatée sur la requête brute posée par la plateforme
après vérification.

`requireCaller` (extrait dans [`functions/src/callerIdentity.ts`](../../functions/src/callerIdentity.ts))
refuse tout appel sans Authentification Firebase, sans attestation App Check
ou avec une adresse email non vérifiée ; le nom affiché est normalisé,
borné à 80 caractères et neutre par défaut. Tests négatifs :
`functions/test/caller.test.ts`.

#### Extracteur pur `observedCaller(request)`

[`functions/src/observedCaller.ts`](../../functions/src/observedCaller.ts)
expose `observedCaller(request)`, un extracteur **pur et sans dépendance SDK**
qui lit `request.auth` et `request.app` pour produire une `ObservedCaller` :
`authenticated` (`auth` défini), `appCheckAttested` (`app` défini),
`emailVerified` (`token.email_verified === true`, comparaison stricte, jamais
coercée) et `uid`. Il ne dépend ni de Firestore, ni d'Admin SDK, ni de
firebase-functions, et reste testable hors émulateur.

Cet extracteur est distinct de `requireCaller` : il ne lève pas d'erreur, il
**observe** l'identité réellement présente sur la requête. Les décisions
pures (`decideInviteCreation`, `decideInviteRedemption`,
`decideTaskCompletion`) revalident chaque porte en défense profonde à partir
de cette observation, afin que les refus restent exécutables même si une garde
amont venait à s'affaiblir (constats F1-identite-decorative-cablage puis
F1-cablage-observe-non-epingle).

#### Câblage dans les trois handlers appelables

`observedCaller(request)` alimente la décision d'autorisation de :

- `createInvite` ([`functions/src/invites.ts`](../../functions/src/invites.ts)) — `caller: observedCaller(request)` ;
- `redeemInvite` ([`functions/src/invites.ts`](../../functions/src/invites.ts)) — `caller: observedCaller(request)` ;
- `completeTask` ([`functions/src/tasks.ts`](../../functions/src/tasks.ts)) — `caller: observedCaller(request)`.

Les portes d'identité (Auth, App Check, email vérifié, uid exploitable) sont
donc dérivées de la requête brute dans les trois handlers, et non d'un objet
constant supposé acquis. `completeTask` valide l'appelant sur l'identité
serveur **observée** : la décision `decideTaskCompletion` refuse un appel
sans Authentification, sans App Check, avec un email non vérifié ou un `uid`
vide, **avant** toute lecture d'adhésion, de propriété ou d'idempotence.

#### Épinglage source dédié et ses limites

Le câblage est verrouillé par
[`functions/test/observedCallerWiring.test.ts`](../../functions/test/observedCallerWiring.test.ts)
(constat BE-C4-F1) : il compte exactement **2** occurrences de
`caller: observedCaller(request)` dans `invites.ts` (createInvite +
redeemInvite) et **1** dans `tasks.ts` (completeTask), interdit tout littéral
d'identité constant (`authenticated`/`appCheckAttested`/`emailVerified: true`)
et exige l'import de l'extracteur partagé. Un retour aux constantes ou un
arrêt de lecture de la requête fait échouer ces tests.

**Limite connue (constat BE-CYCLE32961708279-F2)** : cet épinglage est
**textuel** (regex `WIRING_PATTERN` + `IDENTITY_LITERAL_PATTERN` sur la source
compilable), pas comportemental au niveau handler. Lors d'une future passe
avec émulateur Firestore, il devra être complété par un épinglage
comportemental ; tout renommage légitime de `request`/`observedCaller` devra
mettre à jour l'épinglage explicitement avec preuve de mutation.

#### Refus négatifs cross-foyer / cross-user (deux foyers)

Les tests de [`functions/test/taskCompletion.test.ts`](../../functions/test/taskCompletion.test.ts)
prouvent l'isolation entre au moins deux foyers et deux utilisateurs, en
empruntant le même chemin production (requête → `observedCaller` → décision) :

- **cross-foyer** : `user_1` membre actif du foyer A mais exclu du foyer B
  (tâche pourtant à son nom) ; une requête ciblant le foyer B est refusée
  `permission-denied` « Accès au foyer refusé. », tandis que la même identité
  attestée complète normalement dans le foyer A ;
- **cross-user** : `user_2` membre actif du foyer A mais non propriétaire de
  `task_a1` ; la complétion est refusée `permission-denied` « Cette tâche
  appartient à un autre membre. », l'`uid` venant de `request.auth` côté
  serveur, jamais du corps ;
- une identité dégradée observée (sans Auth, sans App Check, email non
  vérifié, `uid` vide) est refusée par le module pur lui-même, avant même le
  rejeu d'une clé d'idempotence consommée.

Ces refus sont prouvés en logique pure (décision isolée), pas par exécution
bout en bout des handlers — voir contrôles encore bloqués.

## Contrôles exécutés lors du cycle 33086880966

Mesurés par le codeur sur l'arbre courant au moment de la rédaction (aucun
chiffre copié d'un rapport antérieur ; le décompte ci-dessous a été rejoué
intégralement à ce cycle, pas recopié du cycle 33080384862) :

- `npm --prefix functions run check` : typage strict (tsc) + **106/106 tests
  unitaires purs passants, 0 ignoré, 0 échoué** (ordre et application des
  événements Stripe, échec fermé sur état illisible, identité appelant,
  extracteur observé et son épinglage, invitations, complétion de tâche avec
  isolation cross-foyer/cross-user, domaine, validation) ;
- `npm --prefix functions audit --omit=dev --audit-level=high` : **non
  exécuté dans ce bac à sable agent** — la commande est bloquée par la règle
  d'environnement (seuls `npm run check`/`test` et `npm --prefix functions run
  check` sont autorisés). L'ensemble de dépendances reste celui épinglé dans
  `functions/package.json` (firebase-admin 14.3.0, firebase-functions 7.3.2,
  stripe 22.5.0) ; l'auditeur indépendant du cycle relancera l'audit. Aucun
  chiffre d'audit n'est donc affirmé ici ;
- aucun secret, aucun appel réseau, aucune donnée personnelle dans les tests ;
  le secret de test `whsec_local_unit_test_only` est factice et réservé aux
  tests.

## Contrôles encore bloqués (non prouvés)

Liste honnête, à jour de ce cycle — aucun de ces points n'est présenté comme
résolu :

- **exécution bout en bout des handlers appelables** (`createInvite`,
  `redeemInvite`, `completeTask`) sur Firestore émulé : la logique pure est
  testée, mais les handlers ne s'exécutent pas de bout en bout sans émulateur
  (constat BE-CYCLE32961708279-F3) ; `requireCaller` reste appelé en tête des
  trois handlers et `enforceAppCheck` est conservé ;
- **épinglage comportemental** au niveau handler : l'épinglage source actuel
  est textuel (constat BE-CYCLE32961708279-F2) ; à compléter lors de
  l'incrément émulateur, avec rejeu des refus cross-foyer/cross-user au niveau
  handler ;
- **règles Firestore/Storage** : aucune exécution sur émulateur, y compris
  tests d'isolation inter-foyers ; le candidat de règles précédent reste en
  quarantaine, non modifié ce cycle ;
- **webhook Stripe en mode test** : signature vérifiée en crypto locale mais
  non de bout en bout contre Stripe ; `STRIPE_ENABLED` reste `false` ;
- **concurrence réelle multi-instances et idempotence sous charge** :
  nécessitent un environnement d'intégration ;
- **rétention, suppression, export et TTL** : conception restante avant
  données réelles ;
- **revue humaine indépendante et test d'intrusion** : non réalisés ;
- Firebase réel, Stripe réel, analytics et déploiement restent désactivés
  (`STRIPE_ENABLED`, `STRIPE_LIVE_MODE`, `ANALYTICS_AGGREGATION_ENABLED` à
  `false` par défaut ; secrets fournis uniquement au runtime via le
  gestionnaire de secrets).

Le suivi prioritaire se trouve dans [`../NEXT_CYCLE.md`](../NEXT_CYCLE.md).
