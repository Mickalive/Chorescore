# Prochain cycle accepté

## Jalon

`demo-rc` — application Android locale, persistante, honnête et révisable.

## État au cycle 33295415490

- **DRC-01 reste `in_progress`** — le candidat mobile est indisponible
  (candidate-unavailable) pour le quatrième cycle consécutif. Aucun delta
  produit n'a été appliqué. Le code source conserve toujours l'ancien modèle
  todo-list avec `TaskDefinition`, `entry.taskId`, 4 onglets
  (`Tâches | Classement | Historique | Profil`) au lieu de 3
  (`Ajouter une tâche | Score | To-do`).
- **DRC-02 reste `complete`** — persistance/migration validées avant le
  reset produit.
- **DRC-03/04/05 restent `pending`** — les open findings produit-reset
  (PRODUCT-RESET-DATA, PRODUCT-RESET-BALANCE, PRODUCT-RESET-UX) restent
  unresolved.
- **DRC-06 reste `pending`** — dépend de DRC-01 à DRC-05 complets.
- **DRC-07 reste `complete`** — documentation backend acceptée.
- **Stagnation = 4** — quatrième cycle sans progrès sur la tâche active
  (candidat mobile indisponible — panne fournisseur).

## Prochaine action

Le cycle suivant doit :
1. Produire un candidat mobile qui implémente la refonte Tricount-like ;
2. Remplacer `TaskDefinition` par `CompletedEntry` dans les types ;
3. Ajouter `Household[]` (multi-foyers) au modèle ;
4. Créer la navigation `Ajouter une tâche | Score | To-do` (3 onglets) ;
5. Ajouter `Period = 'week' | 'month' | 'year' | 'all'` ;
6. Préserver persistance, isolation et chrono existants.

## Constats ouverts

| ID | Critère | Sévérité | Statut |
|----|---------|----------|--------|
| PRODUCT-RESET-CORE | DRC-01 | critical | unresolved |
| PRODUCT-RESET-DATA | DRC-03 | high | unresolved |
| PRODUCT-RESET-BALANCE | DRC-04 | high | unresolved |
| PRODUCT-RESET-UX | DRC-05 | high | unresolved |
