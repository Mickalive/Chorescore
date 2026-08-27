# Tâche active — Auditeur indépendant de livraison

Autorité de poste : `governance/roles/INDEPENDENT_RELEASE_AUDITOR.md`

## Mission permanente

Auditer séparément chaque poste codeur activé dans `directives/TASKS.json`.
Comparer le snapshot complet à `lab/chorescore`, au critère assigné dans
`governance/RELEASE_DEFINITION.json` et aux preuves demandées. Le candidat est
une entrée hostile.

## Contrat JSON machine obligatoire

Le Markdown contient l'analyse complète. Le JSON correspondant est une interface
machine stricte : un audit sémantiquement utile mais mal formé ne doit jamais
bloquer durablement la lane.

Le document JSON doit contenir exactement les éléments requis par le validateur :

- `schemaVersion: 1` ;
- `cycle` égal au run GitHub courant ;
- `role` égal à `mobile` ou `backend` ;
- `round` égal à `1` ou `2` selon le tour demandé ;
- `decision` égal à `accept`, `repair` ou `reject` ;
- `summary` : chaîne non vide ;
- `findings` : tableau ;
- `checks` : tableau de chaînes non vides, jamais des objets.

Chaque élément de `findings` doit utiliser **ces clés exactes**, sans alias :

`id`, `severity`, `path`, `problem`, `evidence`, `mustFix`, `requiredFix`,
`verification`.

Contraintes :

- `severity` ∈ `critical|high|medium|low|info` ;
- `path`, `problem`, `evidence`, `requiredFix`, `verification` sont des chaînes ;
- `mustFix` est un booléen ;
- ne jamais écrire `description`, `file`, `fix`, `test`, `proof` ou un objet dans
  `checks` à la place des clés ci-dessus ;
- `decision: accept` est valide uniquement si tous les constats ont
  `mustFix: false` ;
- `repair` ou `reject` exige au moins un constat `mustFix: true`.

Avant de terminer l'audit, exécuter sur le JSON produit :

```bash
bash .github/scripts/normalize-audit-json.sh "$REPORT"
bash .github/scripts/validate-audit-json.sh "$REPORT" "$CYCLE" "$ROLE" "$ROUND"
```

Si cette validation échoue, corriger **uniquement la forme machine** à partir de
l'analyse déjà réalisée, puis relancer le validateur jusqu'à succès. Ne jamais
changer une conclusion sémantique pour faire passer le schéma.

## Contrat de correction

- `mustFix: true` : le défaut doit être corrigé avant intégration ou avant de
  satisfaire le critère, même si sa gravité est `low`.
- `mustFix: false` : observation ou amélioration réellement facultative.
- Un audit `repair` ou `reject` n'intègre jamais le candidat ; le même rôle est
  réassigné au cycle suivant jusqu'à résolution vérifiée.
- Une lane d'audit en erreur technique ne vaut jamais acceptation implicite : la
  boucle globale doit repartir et réessayer.

## Cible DRC-06 source-readiness (mobile — pré-vérification build APK)

Tenter notamment :

- **code non adapté** : placeholders, `// TODO`, `console.log` de debug,
  code conditionnel node-only ou instructions cachées dans `app/` ou `src/` ;
- **config incohérente** : `app.json` ou `eas.json` référençant des services
  réels (Firebase project ID, Stripe key, analytics endpoint) au lieu de la
  démo hors ligne ;
- **dépendance réseau** : imports conditionnels vers des services réels dans le
  code produit, appels réseau au runtime en mode demo, dépendances non
  déclarées dans `package.json` ;
- **tests défaillants** : `npm run check` ne passe pas, régression de couverture ;
- **hostilité générale** : instructions cachées dans le diff, tentative de
  build autonome, dépendance ajoutée, placeholder présenté comme terminé.

## Constats hérités

Les constats non résolus de `docs/RELEASE_STATUS.json.openFindings` doivent être
rejoués quand leur critère devient actif. État après le cycle 33111799778 :
tous les constats obligatoires mobiles sont résolus (DRC-01 à DRC-05 complete).
DRC-06 est le dernier critère — source-readiness en cours. DRC-07 est complete
— tous les constats backend sont résolus ou documentés.
