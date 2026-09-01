# Tâche active — Ingénieur produit mobile

Assignment-Id: DRC-03 (Score filtres + historique filtré + modification/suppression entrées)
Autorité de poste : `governance/roles/MOBILE_PRODUCT_ENGINEER.md`
Sélecteur machine : `directives/TASKS.json`

## Source de vérité

Lire d'abord `MAIN_PROMPT.md`, `governance/RELEASE_DEFINITION.json` et `docs/product-decisions.md` depuis `main`.

## État du cycle précédent

Le cycle 33454013453 a vérifié que la navigation 4→3 onglets est complète.
L'audit indépendant (RUN_33454013453_MOBILE.json) confirme `accept` avec
0 mustFix. 195 tests verts. Zéro delta produit. NAV-4TABS résolu.
DRC-01 marqué complete.

### Ce qui est en place (vérifié cycle 33454013453)

- **Navigation 3 onglets canoniques** : `_layout.tsx` expose exactement
  3 Tabs.Screen (Ajouter une tâche | Score | To-do) — **VÉRIFIÉ COMPLET**
- **Fait par modifiable** : SegmentedControl dans ManualEntryModal
  listant `householdMembers`, défaut `currentUserId`, state
  `performedByMemberId`, `validatePerformedBy` + `planManualEntry`
  isolation foyer, reset `useEffect` après succès — **VÉRIFIÉ COMPLET**
- **Score périodes** : SegmentedControl avec 4 options (Semaine, Mois,
  Année, Depuis le début), filtrage par période, calcul rows via
  buildLeaderboard — **EN PLACE**
- **Score équilibres** : MetricCard Temps total + liste équilibres
  (rank/avatar/name/meta/score/progress) — **EN PLACE**
- **Modèle canonique V3** : CompletedEntry, PersistentTask, TodoItem,
  calculateBalances, householdLimit, migration V2→V3 — accepté
- **195 tests** et export Android
- **Persistence V3** et isolation foyer

### Blocage résiduel DRC-03

**Filtres Score** : `score.tsx` n'affiche pas encore le sélecteur de
filtres Toutes/PersistentTask/Autres exigé par MAIN_PROMPT §5.
L'historique contextuel filtré sous les statistiques n'est pas rendu.
Les graphiques à barres avec noms lisibles et la vue pondérée
secondaire restent à vérifier/ajouter.

**PRODUCT-RESET-DATA** : les entrées libres du journal ne sont pas
encore modifiables/supprimables.

## Findings prioritaire

**PRODUCT-RESET-DATA** (high, DRC-03) — Modification/suppression
entrées libres du journal.

## Tâche bornée : DRC-03 — Score filtres + historique filtré + journal

### 1. Ajouter filtres Score dans score.tsx

Dans `app/(tabs)/score.tsx` :
- Ajouter un état `activeFilter` (default: "all")
- Créer un sélecteur de filtres : Toutes | [chaque PersistentTask] | Autres
- Les PersistentTask du foyer sont listées dynamiquement depuis le store
- Le filtre "Toutes" affiche toutes les entrées
- Le filtre par PersistentTask affiche uniquement les entrées liées à cette PersistentTask
- Le filtre "Autres" affiche les entrées sans PersistentTask assignée
- Appliquer le filtre aux données de calcul (rows, métriques, graphes)

### 2. Historique contextuel filtré sous les stats

- Sous la zone statistiques/équilibres, afficher la liste des CompletedEntry
  qui correspondent à la période ET au filtre sélectionnés
- Chaque entrée affiche : label, durée, fait par, fait pour, date
- Format compact similaire à l'historique sous Ajouter une tâche
- Le compteur indique le nombre d'entrées affichées

### 3. Graphiques à barres avec noms

- Si des graphiques à barres existent, vérifier que le nom du membre
  est directement associé à chaque barre (label ou tooltip)
- Ne pas dépendre d'une couleur permanente par membre
- Les couleurs peuvent servir à la lisibilité mais l'identité est portée
  par le nom

### 4. Vue pondérée secondaire

- Si des entrées ont un coefficient ≠ 1, afficher une section
  "Heures pondérées" sous les stats réelles
- Même logique fait-par/fait-pour mais avec D_pondéré = D_réel × coefficient
- Le temps réel reste toujours la métrique principale

### 5. Modification/suppression entrées libres (PRODUCT-RESET-DATA)

- Permettre la modification d'une entrée libre dans l'historique
  (label, durée, fait par, fait pour, date)
- Permettre la suppression d'une entrée libre avec confirmation
- Le modèle de confiance par défaut autorise modification/suppression
  par n'importe quel membre du foyer
- Après modification/suppression, recalculer les équilibres

### 6. Préserver

- Fait par modifiable (SegmentedControl) préservé dans le formulaire
- Navigation 3 onglets canoniques préservée
- Les 195 tests existants restent verts
- Export Android réussit
- Navigation fonctionne en demo sans réseau

### 7. Tests

- Tests de filtres vérifiant que chaque filtre retourne les bonnes entrées
- Tests d'historique filtré vérifiant la correspondance période + filtre
- Tests de modification/suppression d'entrée libre
- Aucune régression des 195 tests existants

## Preuves attendues

- `app/(tabs)/score.tsx` contient sélecteur de filtres Toutes/PersistentTask/Autres
- `app/(tabs)/score.tsx` affiche historique contextuel filtré sous les stats
- Historique permet modification/suppression d'entrées libres
- Graphiques affichent noms des membres
- Vue pondérée secondaire présente si coefficients ≠ 1
- npm run check vert, 195+ tests, export android succès
