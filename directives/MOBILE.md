# Tâche active — Ingénieur produit mobile

Assignment-Id: DRC-01 (navigation restructure 4→3 onglets)
Autorité de poste : `governance/roles/MOBILE_PRODUCT_ENGINEER.md`
Sélecteur machine : `directives/TASKS.json`

## Source de vérité

Lire d'abord `MAIN_PROMPT.md`, `governance/RELEASE_DEFINITION.json` et `docs/product-decisions.md` depuis `main`.

## État du cycle précédent

Le cycle 33369130489 a vérifié que la réparation Fait par est complète dans
le code accepté. L'audit indépendant (RUN_33369130489_MOBILE.json) confirme
`accept` avec 0 mustFix. 195 tests verts. Zéro delta produit.

### Ce qui est en place (vérifié cycle 33369130489)

- **Fait par modifiable** : SegmentedControl dans ManualEntryModal listant
  `householdMembers`, défaut `currentUserId`, state `performedByMemberId`,
  `validatePerformedBy` + `planManualEntry` isolation foyer, reset useEffect
  après succès — **VÉRIFIÉ COMPLET**
- **Modèle canonique V3** : CompletedEntry, PersistentTask, TodoItem,
  calculateBalances, householdLimit, migration V2→V3 — accepté
- **Quota householdLimit** : source de vérité (pas le booléen)
- **Historique complet V3** sous le formulaire
- **195 tests** et export Android
- **Persistence V3** et isolation foyer

### Blocage résiduel DRC-01

**Navigation 4 onglets** : `app/(tabs)/_layout.tsx` affiche 4 Tabs.Screen
(Tâches, Classement, Historique, Profil) au lieu des 3 canoniques
(Ajouter une tâche | Score | To-do) exigés par MAIN_PROMPT §2 et le
RELEASE_DEFINITION DRC-01. Les onglets Classement, Historique et Profil
doivent être supprimés ou replacés.

## Finding prioritaire

**NAV-4TABS** (high, DRC-01) — Navigation 4→3 onglets canoniques.

## Tâche bornée : DRC-01 —Restructurer navigation 4→3 onglets

### 1. Restructurer _layout.tsx

Dans `app/(tabs)/_layout.tsx` :
- Remplacer les 4 `Tabs.Screen` actuels (index/Tâches, leaderboard/Classement,
  history/Historique, profile/Profil) par exactement 3 :
  - `Ajouter une tâche` (name="index") — formulaire + historique complet
  - `Score` (name="score") — périodes/filtres/stats/équilibres/historique filtré
  - `To-do` (name="todo") — planification future
- Les fichiers `leaderboard.tsx`, `history.tsx` et `profile.tsx` doivent
  être supprimés ou leur contenu déplacé dans les 3 onglets canoniques.

### 2. Onglet Ajouter une tâche (index.tsx)

- Conserver le formulaire de saisie actuel (Fait par modifiable,
  Fait pour, durée manuelle/chrono, label, PersistentTask facultative)
- Afficher l'historique chronologique complet du foyer sous le formulaire
- Chaque entrée affiche : tâche, durée, fait par, fait pour, date

### 3. Onglet Score (score.tsx — nouveau ou existant)

- Sélecteur de période : Semaine | Mois | Année | Depuis le début
- Filtres : Toutes | une entrée par PersistentTask | Autres
- Calcul des équilibres fait-par/fait-pour (somme nulle, compensations)
- Graphiques simples à barres avec noms lisibles (pas couleur=identité)
- Historique contextuel filtré sous les statistiques

### 4. Onglet To-do (todo.tsx — nouveau ou existant)

- Liste des tâches futures du foyer
- Création, attribution, dates, bénéficiaires
- Validation → CompletedEntry (si déjà câblé, préserver)

### 5. Préserver

- Fait par modifiable (SegmentedControl) préservé dans le formulaire
- Les 195 tests existants restent verts
- Export Android réussit
- Navigation fonctionne en demo sans réseau

### 6. Tests

- Tests de navigation vérifiant exactement 3 onglets accessibles
- Tests de chaque onglet vérifiant le contenu attendu
- Aucune régression des 195 tests existants

## Preuves attendues

- `app/(tabs)/_layout.tsx` contient exactement 3 Tabs.Screen
- Aucun fichier leaderboard.tsx, history.tsx, profile.tsx actif
- `app/(tabs)/score.tsx` contient sélecteur de période et affichage équilibres
- `app/(tabs)/index.tsx` contient formulaire + historique complet
- Test de navigation vérifiant les 3 onglets
- npm run check vert, 195+ tests, export android succès
