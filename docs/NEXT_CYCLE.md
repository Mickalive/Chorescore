# Prochain cycle OpenCode / Ox

Ce fichier est la mémoire opérationnelle réécrite par le directeur après chaque
cycle. Il ne remplace jamais `MAIN_PROMPT.md` ni les directives actives.

## État cumulatif (après run 32684730787)

La démo mobile hors ligne reste entièrement fonctionnelle : **58/58 tests
application**, export Android démo vert, aucune requête réseau dans `src/` et
`app/`. Le backend reste volontairement non déployable : **37/37 tests en
logique pure**, aucun service réel activé.

Intégré ce cycle, après audit indépendant et re-vérification du directeur :

- **Mobile** (`08f2a78`, audit `accepter`) : tests d'interaction des quatre
  onglets, rôles `radiogroup`/`radio`, regroupement d'annonce `MetricCard`,
  exposition `ContributionBar`, correction `normalizeTaskName` (contrôles C0/
  DEL/C1 devenus séparateurs).
- **Backend récupéré du run 32680607423** (`94aa3e4`, audit `accepter`) :
  `decideSubscriptionEventApplication` — un événement Stripe ancien ne peut pas
  écraser un état d'abonnement plus récent ; échec fermé sur état de facturation
  illisible ; 14 tests dont signature webhook en crypto locale.
- **Backend legacy du cycle 32675726760-1** (`30e967a`, audit `accepter`,
  conditions B6 remplies par le directeur) : `decideSubscriptionEventOrder`
  (enveloppe, rejeu, ancienneté), extraction `callerIdentity.ts`, 13 tests,
  documentation `docs/security/README.md`.
- **Correction directeur C1** (constat faible de l'audit récupération) :
  `storedBillingStateIsUnreadable` extraite et durcie — un `stripeStatus`
  stocké non textuel fait échouer fermé au lieu d'être réduit à « none » ;
  2 tests négatifs ajoutés.

Rejetés comme snapshots vides (étape agent en échec) : backend courant
`e953442` et récupération mobile `23150cf`. Aucun n'a été intégré. Les gardes
Stripe legacy et récupération sont composées en couches dans la même
transaction ; l'auditeur du prochain cycle doit tenter de casser cette
composition.

## Priorité 1 — sécurité vérifiable

- Logique pure des fonctions appelables : **un domaine unique** (invitations OU
  completion de tâches) avec tests négatifs Auth, App Check, rôle, appartenance
  entre deux foyers, idempotence et double soumission.
- Ne pas recréer les règles Firestore quarantainées ; elles restent bloquées
  jusqu'à exécution réelle sur émulateur.
- Prérequis consignés avant toute activation réelle de Stripe (aucune urgence) :
  départage des événements de même seconde (C2/B1), repli
  `customer.subscription.deleted` (B7), uniformisation des documents
  `stripeEvents/{id}` et test de borne d'identifiant > 256 (B4/B5).

## Priorité 2 — relier le client sans fragiliser la démo

- Conserver `demo` comme mode par défaut, totalement hors ligne.
- Concevoir l'adaptateur Firebase production en échec fermé sans configuration.
- Ne jamais accepter du client le score, le rôle, l'abonnement ou l'heure
  serveur ; les flux Auth n'arrivent qu'après les tests d'isolation.

## Priorité 3 — qualité mobile

- Reformuler l'intitulé obsolète de `tests/validation.test.ts:5`.
- Fiabiliser ou retirer documenté le `autoFocus` de `TaskFormModal` sur
  Android, sans nouvelle dépendance.
- Libellés/rôles restants, états vides et erreurs des quatre onglets testés ;
  TalkBack/VoiceOver restent à valider manuellement avant toute livraison.

## Critère de sortie

Le directeur met à jour une unique branche cumulative et sa PR brouillon, sans
fusion automatique. Il écrit une décision machine lisible. La boucle continue
uniquement si les checks passent, qu'aucun risque critique/élevé ne reste ouvert
et qu'une nouvelle tranche bornée existe. La PR distingue : contrôles passés,
éléments non testés, risques résiduels et actions humaines requises.
