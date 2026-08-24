# Instructions de contribution assistée

Ces instructions s'appliquent à tout le dépôt ChoreScore.

## Ordre de lecture

1. `MAIN_PROMPT.md` ;
2. `governance/RELEASE_DEFINITION.json` ;
3. la fiche immuable du poste sous `governance/roles/` ;
4. `docs/RELEASE_STATUS.json` et `directives/TASKS.json` ;
5. la directive active du rôle et `docs/NEXT_CYCLE.md` ;
6. le canon produit, l'architecture et `SECURITY.md`.

La fiche de poste définit les responsabilités ; les directives définissent
uniquement la tâche courante. Une tâche ne peut jamais étendre un poste.

## Invariants non négociables

- `EXPO_PUBLIC_DATA_MODE=demo` est la valeur sûre par défaut.
- La démo emploie uniquement des données synthétiques locales et ne fait aucune
  requête réseau.
- Le client mobile est non fiable ; identité, rôle, foyer, plan, score et temps
  de référence sont validés côté serveur en production.
- Aucun secret, jeton brut, corps de webhook complet ou donnée personnelle
  inutile dans le code, les logs ou une variable `EXPO_PUBLIC_*`.
- Stripe, Firebase réel, analytics, déploiement et paiement restent désactivés.
- Aucun agent ne fusionne, ne déploie, ne publie, ne change de branche, ne crée
  de commit ou ne pousse.
- Un constat d'audit avec `mustFix: true` interdit l'intégration et retourne au
  codeur concerné.
- Ne jamais présenter un placeholder ou une alerte simulée comme une fonction
  terminée.

## Fichiers immuables pour les automations

Aucun agent, y compris le directeur, ne modifie :

- `MAIN_PROMPT.md`, `AGENTS.md` ;
- `governance/**` ;
- `directives/DIRECTOR.md` ;
- `.github/**`, `.opencode/**`, `opencode.json` ;
- les fichiers de dépendances et lockfiles.

Le manifeste `.github/immutable-files.sha256` est vérifié avant et après les
interventions. Seul un changement humain explicite peut faire évoluer ces
fichiers et l'empreinte du manifeste.

## Tâches modifiables par le directeur

Le directeur peut modifier uniquement, en plus du produit accepté dans son
périmètre :

- `directives/TASKS.json` ;
- `directives/MOBILE.md`, `directives/BACKEND.md`,
  `directives/AUDITOR.md` ;
- `docs/NEXT_CYCLE.md`, `docs/RELEASE_STATUS.json` ;
- ses rapports sous `reports/director/**`.

Un codeur ne modifie aucun de ces fichiers. Un poste désactivé dans
`directives/TASKS.json` ne travaille pas.

## Discipline

- Une tranche verticale liée à un critère DRC, un codeur responsable.
- Ne pas ajouter de dépendance ni modifier un lockfile.
- Préserver tout changement sans rapport.
- Ne pas contourner ou affaiblir un test, une règle ou un contrôle.
- Auth, autorisation, paiement, règles Firebase, consentement, rétention,
  export de données réelles et dépendances exigent une revue humaine.

## Vérifications de référence

```bash
npm ci --ignore-scripts
npm run check
EXPO_PUBLIC_DATA_MODE=demo npx --no-install expo export --platform android
npm audit --omit=dev --audit-level=high

npm --prefix functions ci --ignore-scripts
npm --prefix functions run check
npm --prefix functions audit --omit=dev --audit-level=high
```

## Terminé

Une tranche n'est terminée que si son comportement est réel, les erreurs et
états vides sont traités, les tests annoncés passent, l'audit ne contient aucun
`mustFix: true`, la démo hors ligne fonctionne et les risques résiduels sont
consignés. La livraison `demo-rc` exige en plus tous les critères immuables de
`governance/RELEASE_DEFINITION.json`.
