# Prochain cycle OpenCode / Ox

Ce fichier est la mémoire opérationnelle réécrite par le directeur après chaque
cycle. Il ne remplace jamais `MAIN_PROMPT.md` ni les directives actives.

## État cumulatif (après run 32781937768)

La démo mobile hors ligne reste entièrement fonctionnelle : **79/79 tests
application**, export Android démo vert (~2,8 Mo), aucune requête réseau dans
`src/` et `app/`. Le backend reste volontairement non déployable : **98/98
tests en logique pure**, aucun service réel activé.

Intégré ce cycle, après audit indépendant round 1 (`accept` sur les deux,
aucun repair demandé, aucune version repaired/final présente) :

- **Mobile** (`9d29981`) : synthèses semaine/mois et filtres de l'Historique —
  module pur `src/domain/history.ts` (filtre période/membre sur la fenêtre
  déjà visible, synthèse déterministe minutes/valeur/répartition par tâche),
  deux sélecteurs sur l'onglet, note de plan calme en gratuit, états vides
  distincts, compteur honnête au-delà de 20 lignes ; 7 tests dont un
  bout-en-bout sur le semis réel de la démo.
- **Backend** (`46fb523`) : vérité du câblage d'identité des invitations
  (constat F1 du cycle précédent résolu par le code) — `observedInviteCaller`
  observe `auth`/`app`/`email_verified`/`uid` sur la requête brute et alimente
  les deux décisions ; `exists: inviteSnapshot.exists` transmis au rachat ;
  parité d'erreur porte par porte conservée ; 5 tests négatifs nouveaux
  (identité dégradée refusée avant le rejeu, `email_verified` strict sans
  coercion).
- **Correction directeur** (constat faible audit mobile) : MOB-C4-F2 — test
  nouveau « changement d'année et borne haute “maintenant” » (mois janvier vs
  31 décembre 23:59, 1er janvier inclus, entrée exactement à `now` comptée une
  fois, `now+1 s` exclue), avec démonstration rouge sur mutation `<=` → `<` de
  `isEntryInPeriod` puis vert après restauration.

**Réponses aux constats** (détail complet dans
`reports/director/CYCLE_32781937768.md`) :

- MOB-C4-F1 (faible) : reporté en tête de mission mobile — composant partagé,
  vérification visuelle multi-tailles exigée, hors portée déterministe du
  directeur ;
- MOB-C4-F2 (faible) : corrigé par le directeur ce cycle, preuve de mutation
  consignée ;
- MOB-C4-F3 (info) : reporté dans la même mission mobile (jeton temporel ou
  `now` hors mémo) ;
- F1-cablage-observe-non-epingle (faible) : mission backend prioritaire —
  épingler le câblage (assertion de source ou composition pure) avec
  démonstration rouge→vert ;
- F2-constantes-identite-tasks (info) : même mission backend — généraliser
  l'extracteur observé à `completeTask`.

**Récupération legacy et recovery réévaluées puis closes sans réintégration** :
les répertoires recovery du cycle échoué 32680607423 étaient tous vides (aucun
candidat, aucun audit) ; la preuve legacy (`30e967a`, audit prose sans JSON du
cycle 32675726760-1) reste non intégrable et son diff confirme un état ancien
strictement contenu dans la branche acceptée. Rien à récupérer : le travail
applicable a déjà été porté et audité par les cycles intermédiaires.

## Priorité 1 — sécurité vérifiable

- **Backend** : épinglage du câblage d'identité + généralisation à
  `completeTask` (voir `directives/BACKEND.md`).
- Ne pas recréer les règles Firestore quarantainées ; elles restent bloquées
  jusqu'à exécution réelle sur émulateur.
- Prérequis consignés avant toute activation réelle de Stripe (aucune
  urgence) : départage des événements de même seconde (C2/B1), repli
  `customer.subscription.deleted` (B7), uniformisation des documents
  `stripeEvents/{id}`, test de borne d'identifiant > 256 (B4/B5), test
  d'émulateur de double acceptation concurrente des invitations (F2).

## Priorité 2 — produit canonique

- **Mobile** : robustesse Historique (MOB-C4-F1 + MOB-C4-F3, voir
  `directives/MOBILE.md`), puis prochaine tranche produit à choisir parmi :
  exports expliqués calmement côté Profil, ou consolidation Classement
  (méthode de calcul visible et formulation non culpabilisante déjà présentes
  — vérifier la cohérence avec les nouvelles périodes de l'Historique).
- Conserver `demo` comme mode par défaut, totalement hors ligne ; l'adaptateur
  Firebase production reste en échec fermé sans configuration.

## Priorité 3 — qualité et dettes

- Risques résiduels consignés : rendu visuel grande police/petit écran non
  vérifiable déterministe (MOB-C4-F1, action humaine) ; validation manuelle
  TalkBack/VoiceOver exigée avant toute livraison (MOB-C3-F3) ; course de
  double acceptation des invitations non testée sans émulateur (F2) ;
  câblage transactionnel de `completeTask` dans le même cas (constat F3 du
  cycle 32688156479).

## Critère de sortie

Le directeur met à jour une unique branche cumulative et sa PR brouillon, sans
fusion automatique. Il écrit une décision machine lisible. La boucle continue
uniquement si les checks passent, qu'aucun risque critique/élevé ne reste ouvert
et qu'une nouvelle tranche bornée existe. La PR distingue : contrôles passés,
éléments non testés, risques résiduels et actions humaines requises.
