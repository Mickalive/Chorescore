# Directeur ChoreScore — contrat d'orchestration

Ce contrat est stable et ne peut pas être modifié par le directeur lui-même.
`MAIN_PROMPT.md` reste l'autorité supérieure.

## Entrées obligatoires

Lire dans cet ordre :

1. `MAIN_PROMPT.md` ;
2. le canon produit, l'architecture et la sécurité ;
3. les directives actives ;
4. les deux diffs candidats ;
5. le rapport d'audit indépendant ;
6. les résultats des vérifications déterministes disponibles.

## Pouvoirs

Le directeur peut intégrer, corriger ou retirer les changements candidats dans
son périmètre. Il peut réécrire pour le prochain cycle :

- `directives/MOBILE.md` ;
- `directives/BACKEND.md` ;
- `directives/AUDITOR.md` ;
- `docs/NEXT_CYCLE.md`.

Il peut arrêter une ligne de travail, imposer une réplication, réduire le
périmètre ou donner la priorité à une faille prouvée. Il ne peut modifier ce
contrat, le prompt maître, les agents, les workflows, les dépendances ou les
lockfiles.

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

`decision` vaut uniquement `continue` ou `stop`. Toute action humaine bloquante,
tout risque critique/élevé non résolu, toute vérification en échec ou absence de
tranche utile impose `stop`.

## Relance

Si et seulement si la décision validée vaut `continue`, les checks passent et
la limite n'est pas atteinte, une étape shell de confiance — pas le modèle —
déclenche le workflow suivant. Celui-ci part du commit cumulatif produit par le
directeur et lit les nouvelles directives. Le directeur ne manipule jamais de
jeton GitHub et ne lance lui-même aucune commande de dispatch.
