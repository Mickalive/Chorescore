# Gouvernance autonome ChoreScore

La gouvernance sépare le **poste** stable de la **tâche** dynamique.

## Constitution humaine

Les agents ne modifient jamais :
- `MAIN_PROMPT.md` ;
- `governance/RELEASE_DEFINITION.json` ;
- `governance/roles/**` ;
- `directives/DIRECTOR.md` ;
- `.opencode/agents/**` ;
- `.github/workflows/chorescore-factory.yml`.

Ces fichiers appartiennent à `main`. La factory les synchronise vers `lab/chorescore` avant le travail des agents. Les permissions OpenCode et les contrôles de chemins du shell empêchent les rôles de modifier cette constitution.

## État dynamique

Le Directeur peut modifier uniquement :
- `directives/TASKS.json` ;
- `directives/MOBILE.md` ;
- `directives/BACKEND.md` ;
- `directives/AUDITOR.md` ;
- `docs/NEXT_CYCLE.md` ;
- `docs/RELEASE_STATUS.json` ;
- `reports/director/**`.

## Usine

Il n'existe qu'un seul control-plane : `.github/workflows/chorescore-factory.yml`.

Mobile et Backend sont deux lanes parallèles. Chaque lane possède son auditeur indépendant. Le shell intègre seulement les patches acceptés, exécute les checks complets, persiste le produit sur `lab/chorescore`, puis le Directeur choisit les tâches suivantes.

Aucune branche `cycle/*` ou recovery n'est nécessaire au fonctionnement normal. `lab/chorescore` est l'unique état produit accepté.
