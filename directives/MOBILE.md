# Runner mobile — directive active

Autorité : directeur ChoreScore, sous réserve de `MAIN_PROMPT.md`.

## État actuel (après cycle 32692689814)

La démo hors ligne reste intégralement fonctionnelle : **71/71 tests
passants**, export Android démo vert (~2,8 Mo), aucune requête réseau dans
`src/` et `app/`. Ont été intégrés et audités ce cycle (`be11a8a`, audit
round 1 `accept`, aucun repair demandé) :

- focus des deux modales via l'événement `onShow` de `Modal`, remplaçant le
  délai magique de 200 ms ; repli documenté si une plateforme ne déclenche
  pas `onShow` (échec bénin, champ atteignable au clavier) ;
- module pur `src/domain/formFeedback.ts` : jeton croissant + message,
  remontage de nœud frais par `key` pour re-annonce Android (région live
  `assertive`) et annonce impérative iOS (`announceForAccessibility`) ;
- 8 nouveaux tests honnêtes sur conditions de données pures
  (`tests/form-feedback.test.ts`), avec les vrais validateurs.

Corrections directeur sur constats faibles de l'audit (intégrées après le
cherry-pick, vérifiées par la batterie complète) :

- **MOB-C3-F1** : les commentaires des deux modales n'invoquent plus un
  « motif TaskRow » inexistant ; ils décrivent le mécanisme pour lui-même
  (jeton → key fraîche → re-annonce) et la différence exacte
  `assertive`/`polite`.
- **MOB-C3-F2** : garde de visibilité sur `onShow` — un ref miroir
  (`isOpenRef`) empêche tout focus d'un TextInput monté mais invisible si la
  modale est fermée pendant son animation d'ouverture.

## Mission prioritaire — une seule tranche bornée

**Historique : synthèses semaine/mois et filtres**, sans nouvelle dépendance :

1. Sélecteur(s) pur(s) dans `src/domain/` : synthèse hebdomadaire et mensuelle
   des entrées (total de minutes, répartition par tâche), fondés sur
   `startOfWeek`/`startOfMonth` existants ; frontières locales documentées.
2. Filtres simples sur la liste de l'onglet Historique (période semaine/mois,
   éventuellement par membre du foyer de démonstration), état vide calme si
   rien ne correspond.
3. Limites de plan expliquées calmement au moment pertinent (repli gratuit :
   historique 30 jours, poids effectif 1) — jamais de blocage d'une fonction
   annoncée gratuite, jamais de faux achat.
4. Tests ciblés succès/états vides/frontières de période (changement de mois,
   de semaine) pour chaque sélecteur.

Interdits inchangés : pas d'Auth/Firebase/Stripe, pas de réseau, pas de
nouvelle dépendance, calcul canonique `(durée/60) × poidsFigé` intact, ton non
culpabilisant, palette canonique de `docs/product-decisions.md` inchangée.

## Dettes reportées (ne pas traiter dans cette tranche)

- **MOB-C3-F3 (info)** : le câblage UI des annonces (`computeErrorAnnouncement`
  dans `submit`, `key={token}` sur la vue live) reste couvert uniquement par
  conditions de données. La résolution exige soit des tests de composants
  (interdits sans dépendance nouvelle et justification), soit une validation
  manuelle TalkBack/VoiceOver consignée — action humaine, pas un travail de
  runner.

## Preuves attendues

- tests ciblés succès/erreur/frontière nouveaux ou adaptés ;
- `npm run check` vert, 0 test ignoré ;
- export Android démo reproductible ;
- liste exacte des comportements non vérifiés (TalkBack/VoiceOver restent hors
  portée déterministe et exigent une validation humaine avant livraison).
