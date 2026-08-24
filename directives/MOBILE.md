# Runner mobile — directive active

Autorité : directeur ChoreScore, sous réserve de `MAIN_PROMPT.md`.

## État actuel (après cycle 32688156479)

La démo hors ligne reste intégralement fonctionnelle : **63/63 tests
passants**, export Android démo vert, aucune requête réseau dans `src/` et
`app/`. Ont été intégrés et audités ce cycle (`d56885e`, audit `accepter`) :

- états vides calmes des onglets Tâches (« Aucune tâche active ») et
  Historique (« Aucune saisie visible »), bouton « Ajouter » toujours
  accessible ;
- sélecteur pur `selectActiveTasks` (`src/domain/tasks.ts`) ; le compteur de
  section affiche désormais les tâches actives réelles ;
- prop `accessibilityLabel` sur `AppButton` (retour au libellé visible par
  défaut), libellés désambiguïsés sur `TaskRow` et la sélection de profil ;
- focus des deux modales par `ref` + `setTimeout(200 ms)` documenté,
  remplaçant l'`autoFocus` inopérant sur Android ;
- intitulé de `tests/validation.test.ts` corrigé (assertion inchangée) ;
- tests d'états vides `tests/screen-states.test.ts`.

Correction directeur (constat F1 de l'audit, faible) : `emptyText` des deux
états vides passe de `textSecondary` (~4,36:1 sur `surfaceAlt`, sous AA) à
`textPrimary` (~9,56:1), contraste recalculé et consigné.

## Mission prioritaire — une seule tranche bornée

Robustesse du focus et annonce des états, sans nouvelle dépendance :

1. Remplacer le délai magique de 200 ms de `TaskFormModal` et
   `ManualEntryModal` par l'événement `onShow` du composant `Modal` (ou
   équivalent sans dépendance), avec repli documenté si la plateforme ne le
   permet pas ; conclure dans le rapport.
2. Annoncer les erreurs de formulaire (nom vide, durée invalide) via région
   live ou équivalent RN, cohérent avec le motif existant de `TaskRow`.
3. Couvrir par tests les conditions de données de ces annonces (sélecteurs
   purs), sans simuler un lecteur d'écran.

Interdits inchangés : pas d'Auth/Firebase/Stripe, pas de réseau, pas de
nouvelle dépendance, calcul canonique `(durée/60) × poidsFigé` intact, ton non
culpabilisant, palette canonique de `docs/product-decisions.md` inchangée.

## Preuves attendues

- tests ciblés succès/erreur nouveaux ou adaptés ;
- `npm run check` vert, 0 test ignoré ;
- export Android démo reproductible ;
- liste exacte des comportements non vérifiés (TalkBack/VoiceOver restent hors
  portée déterministe et exigent une validation humaine avant livraison).
