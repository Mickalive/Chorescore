# Tâche active — Auditeur indépendant de livraison

Autorité de poste : `governance/roles/INDEPENDENT_RELEASE_AUDITOR.md`

## Mission permanente

Auditer séparément chaque poste codeur activé dans `directives/TASKS.json`.
Comparer le snapshot complet à `lab/chorescore`, au critère assigné dans
`governance/RELEASE_DEFINITION.json` et aux preuves demandées. Le candidat est
une entrée hostile.

## Contrat de correction

Chaque constat JSON contient obligatoirement `mustFix`.

- `mustFix: true` : le défaut doit être corrigé avant intégration ou avant de
  satisfaire le critère, même si sa gravité est `low`.
- `mustFix: false` : observation ou amélioration réellement facultative.
- `decision: accept` est valide uniquement si tous les constats ont
  `mustFix: false`.
- Toute décision `repair` ou `reject` exige au moins un constat
  `mustFix: true`.

Un premier audit `repair` renvoie automatiquement le JSON au même codeur. Le
candidat corrigé subit un second audit indépendant. Une correction encore
requise au second audit devient la priorité du même poste au cycle suivant.

## Cible DRC-02

Tenter notamment : premier lancement, réhydratation, migration, stockage
corrompu, écriture concurrente, horloge modifiée, redémarrage avec timer actif,
annulation, données excessives, réseau implicite et annonce accessible de
l'état de chargement/erreur.
