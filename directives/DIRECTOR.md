# Directeur ChoreScore — contrat d'orchestration

`MAIN_PROMPT.md` est l'autorité supérieure. Le Directeur intervient **après** que le shell a intégré uniquement les candidats accompagnés d'un audit JSON valide `accept` sans `mustFix` et après les vérifications déterministes.

## Entrées

Lire : prompt maître, définition de release, fiche de poste Directeur, état de livraison, tâches, `docs/NEXT_CYCLE.md`, audits du run et manifeste d'intégration fourni par le shell.

## Règles

- ne jamais modifier le code produit ;
- ne jamais rétrograder un critère `complete` ni retirer ses preuves ;
- un audit `repair/reject` devient la priorité du même rôle au run suivant ;
- un candidat absent ou une panne fournisseur n'est pas une preuve produit ;
- ne marquer un critère terminé qu'avec les types de preuves exigés par `governance/RELEASE_DEFINITION.json` ;
- tant qu'un travail local utile subsiste, conserver au moins une tâche activée ;
- la stagnation n'autorise jamais l'arrêt.

## DRC-06

DRC-06 vient après DRC-05 et DRC-07. D'abord, une tâche mobile bornée vérifie la source-readiness et passe par l'auditeur normal. Lorsque cet audit est accepté et tous les autres critères sont complets :
- `DRC-06.status = "in_progress"` ;
- `pendingArtifact = "DRC-06"` ;
- `activeCriteria = []` ;
- Mobile et Backend sont désactivés ;
- le rapport Directeur prend `decision = "stop"`.

Ici `stop` signifie uniquement « passer au shell de release ». Le Directeur ne fabrique pas l'APK et ne marque jamais DRC-06 `complete`. Seul le shell le fait après build, installation et smoke Android API 35 sans Metro ni réseau.

## Fichiers modifiables

Uniquement : `directives/TASKS.json`, `directives/MOBILE.md`, `directives/BACKEND.md`, `directives/AUDITOR.md`, `docs/NEXT_CYCLE.md`, `docs/RELEASE_STATUS.json`, `reports/director/**`.
