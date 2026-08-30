# Tâche active — Ingénieur produit mobile

Assignment-Id: DRC-01 (tranche 2 — câblage UI)
Autorité de poste : `governance/roles/MOBILE_PRODUCT_ENGINEER.md`
Sélecteur machine : `directives/TASKS.json`

## Source de vérité

Lire d'abord `MAIN_PROMPT.md`, `governance/RELEASE_DEFINITION.json` et `docs/product-decisions.md` depuis `main`.

## État du cycle précédent

Le candidat cycle 33318451586 a été accepté (audit accept, 0 mustFix, 189 tests). Le modèle canonique V3 est livré :

- **CompletedEntry** : libellé, performedByMemberId, beneficiaryMemberIds, durée manuelle|chrono, date, foyer, persistentTaskId facultatif, pondération — `src/domain/types.ts`
- **PersistentTask** : raccourci + futur filtre Score — `src/domain/types.ts`
- **TodoItem** : tâche future avec bénéficiaires — `src/domain/types.ts`
- **calculateBalances** : logique Tricount fait-par/fait-pour, compensations pair-à-pair — `src/domain/scoring.ts`
- **householdLimit** numérique dans `getEntitlements` (free=1, trial=3, standard=5, pro=10) — `src/domain/entitlements.ts`
- **Migration V2→V3** sans perte silencieuse — `src/store/persistence.ts`
- **189 tests** dont drc01.test.ts, persistence suite, isolation foyer

### Gaps restants (3 findings non-bloquants)

1. **Navigation** : `app/(tabs)/_layout.tsx` affiche encore 4 onglets (Tâches, Classement, Historique, Profil) au lieu de 3
2. **Quota** : `src/store/appReducer.ts` `planCreateHousehold` utilise `canUseMultipleHouseholds` booléen au lieu de `householdLimit`
3. **Writer** : `src/store/AppProvider.tsx` `toDurableState` crée un DurableState V2 ; pas d'UI pour saisir des CompletedEntry

## Finding prioritaire

**PRODUCT-RESET-CORE** (critical, DRC-01) — partie UI restante :
Compléter le parcours UI : 3 onglets, formulaire Ajouter une tâche,
historique complet, writer V3.

## Tâche bornée : DRC-01 tranche 2 — câblage UI

### 1. Navigation 3 onglets

Remplacer `app/(tabs)/_layout.tsx` :
- **Ajouter une tâche** (formulaire + historique complet)
- **Score** (peut être un placeholder vide pour l'instant)
- **To-do** (peut être un placeholder vide pour l'instant)

Conserver l'écran racine foyers hors tabs.

### 2. Formulaire Ajouter une tâche

Dans l'onglet Ajouter une tâche :
- Libellé libre (text input)
- **Fait par** : défaut = utilisateur connecté, dropdown modifiable vers tout membre du foyer
- **Fait pour** : radio "Tout le monde" ou sélecteur multiple de membres (au moins 1 requis)
- **Durée** : deux modes — saisie manuelle (minutes) ou chrono (timer)
- **PersistentTask** : dropdown optionnel (créer ou choisir une existante)
- Bouton enregistrer → crée une CompletedEntry via le store

### 3. Historique complet

Sous le formulaire : liste chronologique de toutes les CompletedEntry du foyer.
Chaque entrée affiche : libellé, durée, fait par, fait pour, date.
Modifiable/supprimable (modèle de confiance).

### 4. Writer V3

Brancher `saveDurableStateV3` dans AppProvider au lieu de `toDurableState`.
L'état AppState doit inclure `completedEntries`, `persistentTasks`, `todoItems`.

### 5. HouseholdLimit comme source quota

Dans `appReducer.ts` `planCreateHousehold` :
- Comparer `households.length < householdLimit` au lieu du booléen
- Garder `MAX_LOCAL_HOUSEHOLDS` comme garde-fou technique
- Tester : free=1 bloque, trial=3, standard=5, pro=10

## Préparer Score (sans l'implémenter de travers)

Le modèle doit permettre le settlement Tricount-like. Score aura les
périodes semaine/mois/année/depuis le début, filtres Toutes/PersistentTask/
Autres, balances/compensations, graphes avec noms directement visibles
sans dépendance couleur identitaire, puis historique filtré.

## Préparer To-do

TodoItem peut être datée ou non, assignée, avoir bénéficiaires,
deadline/reminder et PersistentTask facultative. Lors du check terminé,
le flux final demandera fait-par + durée + fait-pour puis créera une
CompletedEntry.

## UX

KISS, feel-good, fonds teintés, peu de blanc, noms/valeurs lisibles,
aucune interprétation morale automatique.

## Preuves DRC-01 tranche 2 attendues

- écran foyers avec quota householdLimit non hardcodé
- dans le foyer : exactement 3 onglets Ajouter une tâche | Score | To-do
- formulaire Ajouter une tâche avec Fait par/Fait pour/chrono/PersistentTask
- historique complet sous le formulaire
- writer V3 branché, persistance V3 fonctionnelle
- deux réalisations identiques → deux IDs distincts
- isolation par householdId préservée
- npm run check vert, 189+ tests, export android succès
