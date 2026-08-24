# Prochain cycle OpenCode / Ox

Ce fichier est la mémoire opérationnelle réécrite par le directeur après chaque
cycle. Il ne remplace jamais `MAIN_PROMPT.md` ni les directives actives.

## État cumulatif (après run 32688156479)

La démo mobile hors ligne reste entièrement fonctionnelle : **63/63 tests
application**, export Android démo vert, aucune requête réseau dans `src/` et
`app/`. Le backend reste volontairement non déployable : **57/57 tests en
logique pure**, aucun service réel activé.

Intégré ce cycle, après audit indépendant (`accepter` sur les deux) et
re-vérification du directeur :

- **Mobile** (`d56885e`) : états vides calmes Tâches/Historique,
  `selectActiveTasks`, `accessibilityLabel` sur `AppButton`/`TaskRow`/profil,
  focus des modales par `ref` + `setTimeout(200 ms)` documenté, intitulé de
  `tests/validation.test.ts` corrigé, tests d'états vides.
- **Backend** (`531f614`) : `decideTaskCompletion` — décision pure
  d'autorisation (identité, adhésion, rôle, propriété, état, poids figé,
  durée serveur bornée 24 h) et d'idempotence de `completeTask` ; rejeu exact
  sans écriture ; enregistrement illisible → échec fermé ; 19 tests négatifs
  dont isolation entre deux foyers ; sémantique d'erreur préservée.
- **Correction directeur F1** (constat faible audit mobile) : `emptyText` des
  états vides passe à `textPrimary` — contraste ~9,56:1 au lieu de ~4,36:1
  (< AA), recalculé et consigné.
- **Correction directeur F2** (constat faible audit backend, code hérité) :
  `storedBillingStateIsUnreadable` échoue fermé sur statut stocké textuel
  inconnu et marqueur `lastStripeEventCreated` négatif ;
  `ALL_STRIPE_STATUSES` exportée ; tests négatifs ajoutés (57/57).

**Récupération legacy évaluée puis close sans réintégration** :
`30e967a` (cycle 32675726760-1, audit `accepter`) est déjà contenu dans l'état
accepté — le diff `30e967a..HEAD` n'ajoute que des durcissements postérieurs
(`storedBillingStateIsUnreadable`, etc.) sans rien retirer du travail legacy.
Aucun candidat courant ni récupération rejeté ce cycle ; les deux audits du
cycle étaient présents et explicites.

## Priorité 1 — sécurité vérifiable

- Logique pure du domaine **invitations** : création/acceptation — entropie et
  borne du jeton, condensé stocké, expiration, rôle attribué, appartenance,
  double acceptation ; tests négatifs entre deux foyers obligatoires.
- Ne pas recréer les règles Firestore quarantainées ; elles restent bloquées
  jusqu'à exécution réelle sur émulateur.
- Prérequis consignés avant toute activation réelle de Stripe (aucune
  urgence) : départage des événements de même seconde (C2/B1), repli
  `customer.subscription.deleted` (B7), uniformisation des documents
  `stripeEvents/{id}` et test de borne d'identifiant > 256 (B4/B5).

## Priorité 2 — relier le client sans fragiliser la démo

- Conserver `demo` comme mode par défaut, totalement hors ligne.
- Concevoir l'adaptateur Firebase production en échec fermé sans configuration.
- Ne jamais accepter du client le score, le rôle, l'abonnement ou l'heure
  serveur ; les flux Auth n'arrivent qu'après les tests d'isolation.

## Priorité 3 — qualité mobile

- Fiabiliser le focus des modales (`onShow` plutôt que délai de 200 ms),
  annoncer les erreurs de formulaire, sans nouvelle dépendance.
- Risques résiduels consignés : couverture UI des états vides limitée aux
  conditions de données (pas de test de composants) ; validation manuelle
  TalkBack/VoiceOver exigée avant toute livraison ; câblage transactionnel de
  `completeTask` non couvert sans émulateur (constat F3 backend).

## Critère de sortie

Le directeur met à jour une unique branche cumulative et sa PR brouillon, sans
fusion automatique. Il écrit une décision machine lisible. La boucle continue
uniquement si les checks passent, qu'aucun risque critique/élevé ne reste ouvert
et qu'une nouvelle tranche bornée existe. La PR distingue : contrôles passés,
éléments non testés, risques résiduels et actions humaines requises.
