# Gouvernance autonome ChoreScore

Ce dossier sépare durablement **le poste** de **la tâche**.

## Fichiers immuables pour les automations

- `roles/` : fiches de poste, responsabilités, limites et preuves attendues ;
- `RELEASE_DEFINITION.json` : définition humaine et mesurable du jalon à livrer ;
- `VERSION` : version du dispositif de gouvernance.

Ces fichiers, le prompt maître, le contrat du directeur et les quatre définitions
OpenCode actives sont recensés dans `.github/immutable-files.sha256`. Le
workflow vérifie le manifeste et chaque empreinte avant et après les interventions
des agents. Une automation ne peut ni les modifier, ni modifier le manifeste.

## Fichiers de tâches modifiables par le directeur

- `directives/TASKS.json` : postes activés et critère de livraison confié à chacun ;
- `directives/MOBILE.md` et `directives/BACKEND.md` : consignes détaillées ;
- `directives/AUDITOR.md` : risques et preuves à contrôler ;
- `docs/NEXT_CYCLE.md` : synthèse lisible ;
- `docs/RELEASE_STATUS.json` : avancement et preuves cumulatives.

Le directeur ne change jamais sa fiche de poste. Il ne peut changer que ces
fichiers de tâches et d'état, dans les limites du prompt maître.

## Règle d'effectif

Le workflow n'instancie que les codeurs dont `enabled` vaut `true` dans
`directives/TASKS.json`. Pour chaque codeur actif, un audit indépendant est
obligatoire. Le directeur s'exécute toujours après les audits. Un rôle désactivé
ne reçoit pas un faux travail destiné à occuper la boucle.
