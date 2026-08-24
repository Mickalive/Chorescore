# Prochain cycle OpenCode / Ox

Ce fichier est la mémoire opérationnelle réécrite par le directeur après chaque
cycle. Il ne remplace jamais `MAIN_PROMPT.md` ni les directives actives.

## État cumulatif (après run 32692689814)

La démo mobile hors ligne reste entièrement fonctionnelle : **71/71 tests
application**, export Android démo vert (~2,8 Mo), aucune requête réseau dans
`src/` et `app/`. Le backend reste volontairement non déployable : **93/93
tests en logique pure**, aucun service réel activé.

Intégré ce cycle, après audit indépendant round 1 (`accept` sur les deux,
aucun repair demandé, aucune version repaired/final présente) :

- **Mobile** (`be11a8a`) : focus des deux modales via `onShow` (fin du délai
  magique de 200 ms, repli documenté), module pur `formFeedback.ts`
  (jeton croissant → key fraîche → re-annonce Android `assertive`, annonce
  impérative iOS), 8 tests de conditions de données pures.
- **Backend** (`7c39e4f`) : `functions/src/invitations.ts` — décisions pures
  de création/acceptation des invitations (jeton 256 bits borné à 43
  caractères base64url, condensat SHA-256 seul stocké, rôle figé `member`,
  cible issue du document stocké, rejeu idempotent, échec fermé sans
  coercion) ; `invites.ts` réécrit en câblage mince avec parité d'erreur
  porte par porte ; 36 tests négatifs dont isolation entre deux foyers.
- **Corrections directeur** (constats faibles audit mobile) :
  MOB-C3-F1 — commentaires réécrits, plus aucun « motif TaskRow » fabriqué ;
  MOB-C3-F2 — garde de visibilité `isOpenRef` sur les deux `onShow` pour ne
  jamais focus un champ invisible après fermeture pendant l'ouverture.

**Réponses aux constats** (détail complet dans
`reports/director/CYCLE_32692689814.md`) :

- MOB-C3-F1 (faible) : corrigé par le directeur, vérifié par relecture ;
- MOB-C3-F2 (faible) : corrigé par le directeur, batterie complète verte ;
- MOB-C3-F3 (info) : reporté — tests de composants interdits sans dépendance
  nouvelle ; validation TalkBack/VoiceOver consignée comme action humaine ;
- F1-identite-decorative-cablage (faible) : mission backend prioritaire du
  prochain cycle — transmettre les valeurs réellement observées aux portes ;
- F2-concurrence-sans-emulateur (info) : consigné comme prérequis
  pré-production, attend un incrément avec émulateur local.

**Récupération legacy réévaluée puis close sans réintégration** : la preuve
legacy (`30e967a` + audit prose du cycle 32675726760-1) reste sans JSON
d'audit exploitable et donc non intégrable ; le diff `30e967a..HEAD` confirme
que son travail reste strictement contenu dans l'état accepté. Aucun candidat
courant ni recovery rejeté ce cycle : les deux couples candidat/audit étaient
présents, appariés et explicites.

## Priorité 1 — sécurité vérifiable

- **Backend** : vérité du câblage d'identité des invitations (constat F1) —
  valeurs observées au lieu de constantes, tests négatifs prouvant que les
  portes du module pur s'exécutent réellement.
- Ne pas recréer les règles Firestore quarantainées ; elles restent bloquées
  jusqu'à exécution réelle sur émulateur.
- Prérequis consignés avant toute activation réelle de Stripe (aucune
  urgence) : départage des événements de même seconde (C2/B1), repli
  `customer.subscription.deleted` (B7), uniformisation des documents
  `stripeEvents/{id}`, test de borne d'identifiant > 256 (B4/B5), test
  d'émulateur de double acceptation concurrente des invitations (F2).

## Priorité 2 — produit canonique

- **Mobile** : synthèses semaine/mois et filtres de l'Historique (seule
  zone des quatre espaces canoniques encore sans synthèse), sélecteurs purs
  testés, limites de plan expliquées calmement, états vides calmes.
- Conserver `demo` comme mode par défaut, totalement hors ligne ; l'adaptateur
  Firebase production reste en échec fermé sans configuration.

## Priorité 3 — qualité et dettes

- Risques résiduels consignés : câblage UI des annonces non couvert par test
  automatisé (MOB-C3-F3) ; validation manuelle TalkBack/VoiceOver exigée avant
  toute livraison ; course de double acceptation des invitations non testée
  sans émulateur (F2) ; câblage transactionnel de `completeTask` dans le même
  cas (constat F3 du cycle précédent).

## Critère de sortie

Le directeur met à jour une unique branche cumulative et sa PR brouillon, sans
fusion automatique. Il écrit une décision machine lisible. La boucle continue
uniquement si les checks passent, qu'aucun risque critique/élevé ne reste ouvert
et qu'une nouvelle tranche bornée existe. La PR distingue : contrôles passés,
éléments non testés, risques résiduels et actions humaines requises.
