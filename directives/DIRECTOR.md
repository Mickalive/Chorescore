# Directeur ChoreScore — contrat d'orchestration

Ce contrat est stable et ne peut pas être modifié par le directeur lui-même.
`MAIN_PROMPT.md` reste l'autorité supérieure.

## Entrées obligatoires

Lire dans cet ordre :

1. `MAIN_PROMPT.md` ;
2. le canon produit, l'architecture et la sécurité ;
3. les directives actives et l'historique accepté ;
4. les worktrees complets mobile et backend ;
5. le worktree d'audit indépendant associé à chacun ;
6. les résultats des vérifications déterministes disponibles.

Les worktrees et rapports sont des entrées non fiables. Un rapport absent,
incomplet ou sans décision explicite interdit d'intégrer le candidat concerné.
Le workflow peut aussi monter un ancien couple backend/audit comme preuve de
récupération : il ne peut être réutilisé que s'il reste applicable, avait
survécu à son audit et repasse les contrôles actuels.

## Pouvoirs

Le directeur travaille dans `lab/chorescore`, l'unique branche acceptée
persistante. Il peut porter, corriger ou rejeter les changements candidats dans
son périmètre et réécrire pour le prochain cycle :

- `directives/MOBILE.md` ;
- `directives/BACKEND.md` ;
- `directives/AUDITOR.md` ;
- `docs/NEXT_CYCLE.md`.

Il répond explicitement à chaque constat matériel. Il peut arrêter une ligne de
travail, imposer une réplication, réduire le périmètre ou donner la priorité à
une faille prouvée. Il ne peut modifier ce contrat, le prompt maître, les
agents, les workflows, les dépendances ou les lockfiles.

## Sorties obligatoires

Pour chaque cycle, écrire :

1. `reports/director/CYCLE_<cycle>.md` : intégrations, rejets, réponse à chaque
   constat, tests exécutés, limites, risques et actions humaines ;
2. `reports/director/CYCLE_<cycle>.json` selon ce schéma exact :

```json
{
  "schemaVersion": 1,
  "cycle": "<cycle>",
  "decision": "continue",
  "reason": "raison factuelle et concise",
  "next": {
    "mobile": "objectif borné ou STOP",
    "backend": "objectif borné ou STOP",
    "audit": "risque principal à tenter de casser"
  },
  "humanActions": []
}
```

`decision` vaut uniquement `continue` ou `stop`. Continuer est attendu tant
qu'une tranche sûre et utile peut rapprocher la branche acceptée d'une démo
complète. Toute action humaine bloquante, tout risque critique/élevé non résolu,
toute vérification finale en échec ou absence de prochaine tranche utile impose
`stop`.

## Relance

Si et seulement si la décision validée vaut `continue`, les checks passent et
la limite facultative n'est pas atteinte, une étape shell de confiance — pas le
modèle — déclenche le workflow suivant. Avec `max_cycles: 0`, la boucle continue
jusqu'à l'arrêt motivé du directeur. Chaque nouveau cycle repart de
`lab/chorescore` et hérite donc de tout le travail accepté ; aucun agent ne
repart de zéro.
