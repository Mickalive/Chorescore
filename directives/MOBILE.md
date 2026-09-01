# Tâche active — Ingénieur produit mobile

Assignment-Id: DRC-05 (Partage système, calendrier, notifications et UX)
Autorité de poste : `governance/roles/MOBILE_PRODUCT_ENGINEER.md`
Sélecteur machine : `directives/TASKS.json`

## Source de vérité

Lire d'abord `MAIN_PROMPT.md`, `governance/RELEASE_DEFINITION.json` et `docs/product-decisions.md` depuis `main`.

## État du cycle précédent

Le cycle 33522140085 a produit un candidat accept (RUN_33522140085_MOBILE.json, decision accept, 0 mustFix, 237/237 tests, export Android succès). DRC-04 est complet : To-do → CompletedEntry atomique (CreateTodoModal, CompleteTodoModal, COMPLETE_TODO reducer), Score 4 périodes cœur produit sans gate premium. PRODUCT-RESET-BALANCE résolu. Stagnation = 0 (progrès objectif).

### Ce qui est en place (vérifié cycles 33454013453, 33472877686, 33522140085)

- **Navigation 3 onglets canoniques** : `_layout.tsx` expose exactement 3 Tabs.Screen (Ajouter une tâche | Score | To-do) — **VÉRIFIÉ COMPLET**
- **Fait par modifiable** : SegmentedControl dans ManualEntryModal listant householdMembers, défaut currentUserId, state performedByMemberId — **VÉRIFIÉ COMPLET**
- **Score filtres** : SegmentedControl Filtre de tâche (Toutes | PersistentTask | Autres), scoreFilters.ts buildScoreFilterOptions/filterEntriesByTask — **VÉRIFIÉ COMPLET**
- **Score historique filtré** : Section historique filtré sous stats, 30 entrées max, correspondance période+filtre — **VÉRIFIÉ COMPLET**
- **Score graphes** : MemberBarChart noms lisibles, minutes, value, sans dépendance couleur — **VÉRIFIÉ COMPLET**
- **Score vue pondérée** : conditionnelle si useWeights && weightSnapshot≠1, MemberBarChart secondaire — **VÉRIFIÉ COMPLET**
- **Score 4 périodes cœur produit** : Semaine/Mois/Année/Depuis le début sans gate premium — **VÉRIFIÉ COMPLET**
- **Correction/suppression entrées** : EntryCorrectionModal + deleteEntry, isolation foyer propriétaire — **VÉRIFIÉ COMPLET**
- **Modèle canonique V3** : CompletedEntry, PersistentTask, TodoItem, calculateBalances, householdLimit — **EN PLACE**
- **To-do complet** : CreateTodoModal (libellé/date-deadline/assignation/bénéficiaires/note) + CompleteTodoModal (fait-par/durée/fait-pour) + COMPLETE_TODO atomique — **VÉRIFIÉ COMPLET**
- **237 tests** et export Android (1287 modules 2.9MB)
- **Persistance V3** et isolation foyer

## Tâche bornée : DRC-05 — Partage système, calendrier, notifications et UX

### 1. Refonte interface : design propre et léger

Conformément à MAIN_PROMPT §10 (Design) :
- **Fonds teintés doux** : éviter le blanc dominant, utiliser des fonds teintés chauds/chaleureux
- **Surfaces colorées légères** : cartes, badges, éléments interactifs avec couleurs douces
- **Typographie nette** : hiérarchie claire, peu de texte, labels concis
- **Feel-good, chaleureuse, contemporaine, énergique mais pas enfantine**
- **Accessibilité** : contrastes AA maintenus, grandes tailles de texte supportées

### 2. Journal compact sous Ajouter une tâche

Chaque entrée dans l'historique complet affiche de façon compacte :
- Libellé de la tâche
- Durée (heures/minutes)
- Fait par (nom du membre)
- Fait pour (nom(s) du/des bénéficiaire(s))
- Date
- Actions : Corriger / Supprimer (si propriétaire, modèle de confiance)

### 3. Action d'ajout évidente

- Formulaire minimal en haut de l'onglet Ajouter une tâche
- Saisie rapide : label + durée (manuelle ou chrono) + fait par (défaut connecté) + fait pour (défaut tout le monde)
- Pas de friction, pas de catalogues ni catégories obligatoires

### 4. Pondération en Options avancées seulement

- La pondération (coefficient) ne doit apparaître que dans les Options avancées du foyer
- Jamais dans le flux principal d'ajout ou de visualisation
- Le temps réel reste toujours la métrique principale

### 5. Suppression des messages moraux automatiques

- Aucun commentaire qui interprète, moralise ou commente les chiffres/personnes
- Aucun pseudo-conseil relationnel
- Aucune batterie de boutons par ligne
- Le contenu partagé est informatif, pas jugement

### 6. Partage système natif

- Utiliser le share sheet système (pas de SDK social spécifique)
- Depuis Score : partager le score courant (période + filtre), équilibres/compensations
- Depuis l'historique filtré : partager la sélection
- Depuis To-do : partager une To-do ou le planning
- Share card ChoreScore claire et attractive (autour de #ChargeMentale)

### 7. Notifications locales et calendrier

- Notifications locales avec expo-notifications si honnêtement supporté
- Sinon : désactivation honnête avec mention
- Calendrier : préparer les gateways propres, permissions honnêtes
- Aucune simulation de push distant réel

### 8. Non-régressions

- Navigation 3 onglets préservée
- Fait par modifiable préservé
- Filtres Score préservés
- 4 périodes cœur produit préservées
- To-do → CompletedEntry atomique préservé
- 237+ tests restent verts

### 9. Tests

- Tests de design/accessibilité (contrastes, grandes tailles)
- Tests de partage système (si mockable)
- Tests de notifications locales
- Aucune régression des 237 tests existants

## Preuves attendues

- Interface repensée : propre, légère, chaleureuse, sans blanc dominant
- Journal compact sous Ajouter une tâche
- Action d'ajout évidente et rapide
- Pondération uniquement en Options avancées
- Aucun message moral automatique
- Partage système natif fonctionnel
- 237+ tests verts, npm run check vert, export Android succès
