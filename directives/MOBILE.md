# Tâche active — Ingénieur produit mobile

Assignment-Id: DRC-04 (To-do → CompletedEntry atomique + bilan temps réel)
Autorité de poste : `governance/roles/MOBILE_PRODUCT_ENGINEER.md`
Sélecteur machine : `directives/TASKS.json`

## Source de vérité

Lire d'abord `MAIN_PROMPT.md`, `governance/RELEASE_DEFINITION.json` et `docs/product-decisions.md` depuis `main`.

## État du cycle précédent

Le cycle 33472877686 a complété DRC-03. L'audit indépendant (RUN_33472877686_MOBILE.json) confirme `accept` avec 0 mustFix, 211/211 tests (195 existants +16 DRC-03), export Android succès. Filtres Score Toutes/PersistentTask/Autres, historique contextuel filtré, graphes à barres noms lisibles, vue pondérée, correction/suppression entrées libres — tous implémentés et vérifiés. DRC-03 marqué complete.

### Ce qui est en place (vérifié cycles 33454013453 + 33472877686)

- **Navigation 3 onglets canoniques** : `_layout.tsx` expose exactement 3 Tabs.Screen (Ajouter une tâche | Score | To-do) — **VÉRIFIÉ COMPLET**
- **Fait par modifiable** : SegmentedControl dans ManualEntryModal listant householdMembers, défaut currentUserId, state performedByMemberId — **VÉRIFIÉ COMPLET**
- **Score filtres** : SegmentedControl Filtre de tâche (Toutes | PersistentTask | Autres), scoreFilters.ts buildScoreFilterOptions/filterEntriesByTask — **VÉRIFIÉ COMPLET**
- **Score historique filtré** : Section historique filtré sous stats, 30 entrées max, correspondance période+filtre — **VÉRIFIÉ COMPLET**
- **Score graphes** : MemberBarChart noms lisibles, minutes, value, sans dépendance couleur — **VÉRIFIÉ COMPLET**
- **Score vue pondérée** : conditionnelle si useWeights && weightSnapshot≠1, MemberBarChart secondaire — **VÉRIFIÉ COMPLET**
- **Correction/suppression entrées** : EntryCorrectionModal + deleteEntry, isolation foyer propriétaire — **VÉRIFIÉ COMPLET**
- **Modèle canonique V3** : CompletedEntry, PersistentTask, TodoItem, calculateBalances, householdLimit — **EN PLACE**
- **211 tests** et export Android (1287 modules 2.8MB)
- **Persistance V3** et isolation foyer

## Tâche bornée : DRC-04 — To-do et conversion en réalisation

### 1. TodoItem formulaire de création

Dans l'onglet To-do (`app/(tabs)/todo.tsx` ou équivalent) :
- Formulaire de création de TodoItem avec :
  - Libellé (obligatoire)
  - Date/deadline facultative (DatePicker ou sélecteur date)
  - Membre assigné (défaut = membre connecté, modifiable)
  - Bénéficiaires (sélecteur multiple, défaut = tout le foyer)
  - Note facultative
- Persistance dans le store avec isolation foyer
- Affichage de la liste des To-do du foyer (en cours, datées, non datées)

### 2. Validation d'une To-do → mini-formulaire

Quand un membre coche une To-do comme faite :
- Ouvrir un mini-formulaire/modal
- **Fait par** : défaut = membre qui valide, modifiable parmi les membres du foyer
- **Durée réelle** : saisie en minutes (1-1440), validateur strict
- **Fait pour** : reprend les bénéficiaires de la To-do si définis, sinon permet de choisir (sélecteur multiple)
- Bouton valider + bouton annuler

### 3. Création atomique CompletedEntry

La validation du mini-formulaire doit :
1. Créer une `CompletedEntry` indépendante avec :
   - label = libellé de la To-do
   - performedByMemberId = valeur du formulaire fait-par
   - beneficiaryMemberIds = valeur du formulaire fait-pour
   - durationMinutes = durée réelle saisie
   - completedAt = date/heure courante
   - taskId = null (entrée libre, pas liée à une PersistentTask)
   - weightSnapshot = poids courant du membre fait-par
2. Terminer la TodoItem (statut = completed)
3. L'historique complet (tab Ajouter une tâche) affiche immédiatement la nouvelle entrée
4. Score se recalcule immédiatement avec la nouvelle entrée

### 4. Reminders locaux (si honnêtement possible)

- Si le device supporte les notifications locales : proposer un reminder configurable (date/heure de rappel)
- Si non disponible : ne pas simuler, laisser les reminders « à venir » avec mention honnête
- Les reminders ne bloquent pas la création de To-do

### 5. Non-régressions

- Fait par modifiable préservé
- Navigation 3 onglets préservée
- Filtres Score préservés
- Historique contextuel filtré préservé
- 211+ tests restent verts
- Export Android réussit

### 6. Tests

- Tests de création TodoItem (libellé, date, assignation, bénéficiaires, note)
- Tests de conversion To-do → CompletedEntry (atomique, fait-par défaut modifiable, durée, fait-pour, CreatedEntry visible)
- Tests d'isolation foyer (To-do d'un foyer non visible dans l'autre)
- Tests de reminder si implémenté
- Aucune régression des 211 tests existants

## Preuves attendues

- To-do permet créer une TodoItem avec tous les champs
- Le check fait ouvre un mini-formulaire avec fait-par/durée/fait-pour
- La validation crée atomiquement une CompletedEntry + termine la TodoItem
- L'historique complet et Score se mettent à jour immédiatement
- 211+ tests verts, npm run check vert, export Android succès
