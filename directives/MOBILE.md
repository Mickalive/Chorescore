# Runner mobile — directive active

Autorité : directeur ChoreScore, sous réserve de `MAIN_PROMPT.md`.

## État actuel (après cycle 32781937768)

La démo hors ligne reste intégralement fonctionnelle : **79/79 tests
passants**, export Android démo vert (~2,8 Mo), aucune requête réseau dans
`src/` et `app/`. Ont été intégrés et audités ce cycle (`9d29981`, audit
round 1 `accept`, aucun repair demandé) :

- module pur `src/domain/history.ts` : `filterHistoryEntries` (période
  semaine/mois via `isEntryInPeriod`, filtre par membre) et
  `buildHistorySynthesis` (minutes, valeur, répartition par tâche triée de
  façon déterministe : minutes décroissantes, libellé collation « fr »,
  identifiant) ; aucun arrondi métier, aucune comparaison entre membres ;
- onglet Historique recâblé : deux `SegmentedControl` (période, membre),
  synthèse de la sélection, note de plan calme en gratuit (30 jours, poids
  effectif 1), états vides distincts « rien à résumer » / « aucune saisie
  pour ce filtre », compteur honnête quand la liste dépasse 20 lignes ;
- 7 tests nouveaux (`tests/history.test.ts`) dont un bout-en-bout sur le
  semis réel de la démo.

Correction directeur sur constat faible de l'audit (intégrée après le
cherry-pick, vérifiée par batterie complète et contrôle de mutation) :

- **MOB-C4-F2** : test nouveau « le changement d'année et la borne haute
  “maintenant” restent exacts » — mois de janvier vs 31 décembre 23:59,
  1er janvier 00:00 inclus, entrée exactement à `now` comptée une fois,
  `now+1 s` exclue ; démonstration rouge sur mutation `<=` → `<` de
  `isEntryInPeriod`, puis vert après restauration.

## Mission prioritaire — une seule tranche bornée

**Historique : robustesse d'affichage**, en répondant aux deux constats
restants de l'audit round 1, sans nouvelle dépendance :

1. **MOB-C4-F1 (faible)** — le filtre membre est le premier usage dynamique
   de `SegmentedControl` (« Foyer » + membres ; Standard = 7 membres max,
   Pro non borné) dans une rangée unique sans wrap ni défilement.
   Corriger le composant partagé : repli des segments (`flexWrap` +
   largeur minimale par segment) ou défilement horizontal au-delà
   d'environ 4 options, ou bascule vers une liste/selection dédiée quand le
   foyer dépasse ce seuil. Vérifier la non-régression des usages fixes
   existants (leaderboard, profile).
2. **MOB-C4-F3 (info)** — les mémos `filteredEntries` et `synthesis`
   capturent `new Date()` sans dépendance temporelle : une session ouverte
   à travers un changement de semaine/mois garde l'ancienne période.
   Calculer `now` hors mémo par rendu ou inclure un jeton temporel grossier
   dans les dépendances ; documenter la convention retenue pour tout l'écran.

Interdits inchangés : pas d'Auth/Firebase/Stripe, pas de réseau, pas de
nouvelle dépendance, calcul canonique `(durée/60) × poidsFigé` intact, ton non
culpabilisant, palette canonique de `docs/product-decisions.md` inchangée.

## Dettes reportées (ne pas traiter dans cette tranche)

- **MOB-C3-F3 (info)** : câblage UI des annonces couvert uniquement par
  conditions de données ; validation manuelle TalkBack/VoiceOver exigée
  avant toute livraison — action humaine, pas un travail de runner.
- Vérification visuelle grande police/petit écran du correctif MOB-C4-F1 :
  consignée comme action humaine ; le runner livre le code, les tests
  déterministes disponibles et la liste exacte de ce qui reste non vérifié.

## Preuves attendues

- tests ciblés succès/erreur/frontière nouveaux ou adaptés ;
- `npm run check` vert, 0 test ignoré ;
- export Android démo reproductible ;
- liste exacte des comportements non vérifiés (TalkBack/VoiceOver et
  rendu visuel multi-tailles restent hors portée déterministe et exigent
  une validation humaine avant livraison).
