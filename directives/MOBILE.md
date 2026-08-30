# Tâche active — Ingénieur produit mobile

Assignment-Id: DRC-01 (repair — Fait par sélecteur)
Autorité de poste : `governance/roles/MOBILE_PRODUCT_ENGINEER.md`
Sélecteur machine : `directives/TASKS.json`

## Source de vérité

Lire d'abord `MAIN_PROMPT.md`, `governance/RELEASE_DEFINITION.json` et `docs/product-decisions.md` depuis `main`.

## État du cycle précédent

Le candidat cycle 33328400903 a été rejeté (audit repair, 1 mustFix).
Le candidat précédent cycle 33318451586 avait accepté le modèle V3
(189 tests). Le code dans lab/chorescore conserve le modèle V3 accepté
avec les 3 onglets, householdLimit, historique complet et writer V3
déjà câblés. Le seul blocage est le champ Fait par.

### Ce qui est en place (depuis cycle 33318451586 + candidat 33328400903)

- **Modèle canonique V3** : CompletedEntry, PersistentTask, TodoItem,
  calculateBalances, householdLimit, migration V2→V3 — accepté
- **Navigation 3 onglets** : Ajouter une tâche | Score | To-do
- **Quota householdLimit** : source de vérité (pas le booléen)
- **Historique complet V3** sous le formulaire
- **Writer V3** branché (createSequentialWriterV3/toDurableStateV3)
- **189 tests** et export Android

### Blocage unique

**Fait par statique** : `app/(tabs)/index.tsx` affiche
`{performer?.name ?? '—'}` sans sélecteur. L'utilisateur ne peut pas
choisir un autre membre du foyer comme réalisateur. Cela viole
MAIN_PROMPT §3 et l'acceptance #3 de DRC-01.

## Finding prioritaire

**PRODUCT-RESET-CORE** (critical, DRC-01) — Fait par non modifiable.

## Tâche bornée : DRC-01 repair — rendre Fait par modifiable

### 1. Sélecteur Fait par

Dans `app/(tabs)/index.tsx` :
- Remplacer l'affichage statique `{performer?.name ?? '—'}` par un
  sélecteur interactif (chips, SegmentedControl ou Picker) listant
  **tous les `householdMembers`** ;
- Défaut = `currentUserId` (utilisateur connecté) ;
- La valeur sélectionnée est stockée dans l'état local `performedByMemberId` ;
- Après soumission réussie, réinitialiser à `currentUserId`.

### 2. Intégration handleSubmit

- `handleSubmit` utilise `performedByMemberId` (pas `performer.id` fixe) ;
- Valider via `planAddCompletedEntry` (déjà prêt) ;
- La CompletedEntry créée a `performedByMemberId` correspondant à la
  sélection.

### 3. Tests

- Ajouter/mettre à jour un test d'intégration UI qui valide :
  - `validatePerformedBy` est appelé avec la bonne valeur ;
  - La capacité de choisir un autre membre que le connecté ;
  - La sélection est utilisée dans la CompletedEntry créée.

### 4. Préserver

- Les 189 tests existants restent verts ;
- Les 3 onglets Ajouter une tâche | Score | To-do restent fonctionnels ;
- L'export Android réussit.

## Preuves attendues

- `app/(tabs)/index.tsx` contient un sélecteur Fait par interactif ;
- `handleSubmit` utilise `performedByMemberId` de l'état ;
- Test d'intégration validant la sélection d'un autre membre ;
- npm run check vert, 189+ tests, export android succès ;
- Deux créations avec différents performeurs → CompletedEntry avec
  performedByMemberId distincts.
