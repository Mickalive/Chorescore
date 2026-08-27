# ChoreScore — Lessons Learned & Permanent Guardrails

Ce document conserve les enseignements opérationnels tirés de la construction réelle de ChoreScore. Il ne remplace pas `MAIN_PROMPT.md`, mais il sert de mémoire technique durable : lorsqu’un problème analogue réapparaît, il faut appliquer ces règles avant d’inventer une nouvelle architecture ou un nouveau mécanisme.

## 1. Diagnostiquer avant de corriger

### Erreur observée
Plusieurs runs rouges ont été interprétés trop vite comme des échecs d’orchestration, de modèle ou de produit alors que la cause exacte se trouvait plus loin dans le log.

### Règle permanente
- Toujours lire le **job fautif exact** puis le **log jusqu’à la ligne exacte qui provoque l’exit** avant de modifier quoi que ce soit.
- Ne jamais corriger un symptôme à partir du seul statut rouge du run.
- Classer d’abord la panne : `provider/model`, `agent`, `audit`, `integration`, `state/protocol`, `build`, `runtime-smoke`, `GitHub infrastructure`.
- Ne modifier que la couche réellement fautive.

## 2. Distinguer progression produit et progression administrative

### Erreur observée
Le code pouvait être déjà corrigé tandis que `RELEASE_STATUS.json` était encore en retard ; un run rouge pouvait aussi avoir intégré un vrai progrès avant de casser plus tard.

### Règle permanente
Toujours distinguer explicitement :
1. code présent dans `lab/chorescore` ;
2. tests déterministes verts ;
3. audit indépendant accepté ;
4. état DRC persisté ;
5. artefact réellement construit ;
6. runtime-smoke réellement exécuté.

Ne jamais dire « terminé » si seule une étape antérieure est vraie.

## 3. `lab/chorescore` est l’unique état produit accepté

### Erreur observée
Les anciennes architectures multipliaient branches, recovery states, launch bridges, watchdogs et machines d’état concurrentes.

### Règle permanente
- `lab/chorescore` est la seule progression produit cumulative.
- Les candidats et audits sont temporaires.
- Pas de `cycle/*`, recovery branches, Launch Bridge ou seconde machine d’état.
- Persister toute progression objectivement acceptée **avant** une étape fragile comme le Director ou un provider externe.
- Un run rouge ne doit jamais annuler un progrès déjà accepté.

## 4. Une seule orchestration

### Erreur observée
Plusieurs workflows pouvaient se relancer, se rerun ou se surveiller mutuellement, créant des boucles opaques et des doublons.

### Règle permanente
- Une seule Factory.
- Un seul groupe de concurrence.
- Pas de watchdog séparé quand le cron de la Factory suffit.
- Pas de mécanisme de recovery parallèle.
- Un cycle doit être compréhensible de bout en bout.

La robustesse vient d’un état cumulatif propre et de reprises idempotentes, pas de la multiplication des contrôleurs.

## 5. Les sources de vérité ne doivent jamais se contredire

### Erreur observée
Le Director, `RELEASE_DEFINITION.json`, le shell d’intégration et le shell de release n’avaient pas toujours le même contrat, notamment sur DRC-06 et la prétendue lane `source-readiness`.

### Règle permanente
Pour tout gate terminal ou transition majeure :
- définir le contrat une seule fois conceptuellement ;
- vérifier que `MAIN_PROMPT`, release definition, Director, intégration et release shell expriment **la même condition** ;
- supprimer tout reliquat d’une ancienne architecture ;
- ne jamais ajouter une passe intermédiaire qui n’apporte aucune nouvelle preuve.

Quand un deadlock apparaît entre deux composants, rechercher d’abord une contradiction de contrat avant d’ajouter du code.

## 6. Zéro diff peut être un succès

### Erreur observée
Un ingénieur constatait parfois que la correction demandée était déjà présente. La Factory traitait alors l’absence de patch comme un échec.

### Règle permanente
- `no diff` n’est pas automatiquement une erreur.
- Si l’état accepté satisfait déjà la tâche, produire un **candidat de vérification zéro-diff**.
- Faire quand même passer les tests et l’audit indépendant.
- Ne jamais fabriquer un faux changement uniquement pour satisfaire un protocole de patch.

## 7. Un audit doit rester indépendant

### Règle permanente
- Le codeur ne s’auto-certifie jamais.
- L’auditeur part de l’état accepté + candidat exact.
- Un `mustFix: true` bloque l’intégration.
- Si plusieurs modèles sains existent, préférer un modèle d’audit différent du modèle codeur.
- Ne jamais affaiblir un test, un seuil ou une garde pour obtenir du vert.

## 8. Ne jamais dépendre d’un modèle gratuit unique

### Erreur observée
Ox `x-preview-f-free` a cessé d’être fiable pour le tool-calling ; attendre son retour bloquait toute l’usine.

### Règle permanente
- Les modèles gratuits sont des ressources interchangeables et volatiles.
- Tester le pool à chaque cycle.
- Un modèle présent dans la documentation n’est pas présumé utilisable.
- Un modèle qui répond à du texte n’est pas présumé capable de fonctionner comme agent.

Le probe doit tester un **vrai tool-call headless** avec une information impossible à deviner sans outil.

## 9. Tester aussi la latence des modèles

### Erreur observée
Nemotron 3.5 Lightning passait le probe mais mettait déjà ~56 s, puis pouvait monopoliser une lane pendant des dizaines de minutes.

### Règle permanente
- `healthy` ≠ `appropriate`.
- Mesurer la latence du probe.
- Prioriser les modèles rapides et fiables pour les lanes interactives.
- Reléguer les modèles lents même s’ils techniquement réussissent.
- Conserver des fallbacks.

## 10. Passer le modèle explicitement en CLI

### Erreur observée
Le modèle déclaré dans le frontmatter d’agent peut être ignoré dans certains chemins headless.

### Règle permanente
Le modèle effectif est toujours passé explicitement à `opencode run --model ...`. Le frontmatter ne constitue pas une preuve du modèle réellement utilisé.

## 11. Une panne provider ne doit jamais détruire ou bloquer définitivement l’état

### Règle permanente
- Retries bornés.
- Timeout borné.
- Retour au cycle suivant depuis `lab/chorescore`.
- Aucun rerun infini d’un même run.
- Aucune panne fournisseur ne transforme une release incomplète en succès ni en état terminal.

## 12. Les étapes inutiles doivent être sautées

### Erreur observée
Une fois DRC-06 prêt, refaire les probes, ingénieurs, audits et Director aurait gaspillé du temps et créé de nouveaux risques.

### Règle permanente
Si `pendingArtifact == DRC-06`, la Factory doit aller **directement** au pipeline release.

Plus généralement, chaque run doit exécuter seulement les étapes capables d’ajouter une preuve nouvelle.

## 13. Tester le chemin de release réel tôt

### Erreur observée
Les checks JS/TS et l’export Android étaient verts, mais le premier vrai `expo prebuild` n’a été exercé qu’à la toute fin, révélant une mutation attendue de `package.json`.

### Règle permanente
- Ne pas confondre `expo export` avec un vrai build natif.
- Avant la dernière minute, exercer au moins une fois le chemin natif génératif : prebuild + configuration Gradle, idéalement sur un état jetable.
- Les étapes terminales critiques doivent avoir un test de chemin, pas seulement des validations de fichiers.

## 14. Comprendre les générateurs avant d’appliquer une garde d’immutabilité

### Erreur observée
`expo prebuild` modifiait automatiquement :
- `android`: `expo start --android` → `expo run:android` ;
- `ios`: `expo start --ios` → `expo run:ios`.

Notre `git diff --exit-code` interprétait cette normalisation Expo comme une corruption et arrêtait le job **avant même Gradle**.

### Règle permanente
- Identifier les mutations normales d’un générateur.
- Soit normaliser la source en amont, soit exécuter le générateur dans un espace jetable et restaurer les fichiers source après génération.
- Une garde d’immutabilité doit détecter des mutations **inattendues**, pas tuer les mutations documentées nécessaires au build.
- Vérifier séparément que le générateur n’a pas modifié dépendances, lockfiles ou configuration métier de manière non autorisée.

## 15. Ne jamais appeler “échec Gradle” ce qui n’a pas atteint Gradle

### Règle permanente
Dans un pipeline, nommer la phase réellement atteinte. Exemple :
- prebuild failure ;
- source-diff gate failure ;
- Gradle configuration failure ;
- compilation failure ;
- packaging/signing failure ;
- emulator failure ;
- runtime-smoke failure.

Le diagnostic doit utiliser la dernière commande réellement exécutée, pas le nom générique du job.

## 16. Rerun minimal plutôt que refaire toute l’usine

### Règle permanente
Lorsqu’un état produit est déjà accepté et que seule une phase terminale échoue :
- reprendre depuis l’état accepté ;
- sauter agents/audits/Director inutiles ;
- rerun uniquement la phase fautive lorsque GitHub le permet ;
- sinon déclencher un nouveau cycle qui route directement vers cette phase.

## 17. Les erreurs d’orchestration doivent produire des messages explicites

### Erreur observée
Des `exit 1` ou validations jq opaques ont rendu certains échecs difficiles à comprendre.

### Règle permanente
- Chaque garde non triviale doit expliquer ce qu’elle attend et ce qu’elle a trouvé.
- Utiliser des codes de sortie distincts quand cela apporte un diagnostic utile.
- Préférer une erreur précise à un `jq -e` silencieux.

## 18. Attention au scope jq et aux validations contextuelles

### Erreur observée
Une expression jq a changé `.` vers une chaîne de rôle puis tenté d’accéder à `.assignments`, provoquant un échec de `prepare`.

### Règle permanente
Pour des expressions jq imbriquées :
- capturer explicitement la racine (`. as $root`) avant une itération ;
- référencer `$root` dans les scopes descendants ;
- tester les validateurs sur des fixtures minimales avant de les mettre dans le chemin critique.

## 19. Le sync statique ne doit jamais écraser l’état dynamique

### Règle permanente
`main` porte le control-plane et la constitution ; `lab/chorescore` porte l’état accepté cumulatif.

La synchronisation de `main` vers `lab/chorescore` ne doit jamais écraser par inadvertance :
- `directives/TASKS.json` ;
- `docs/RELEASE_STATUS.json` ;
- les preuves dynamiques du cycle.

## 20. Les checks doivent prouver le comportement réel, pas seulement la présence de code

### Règle permanente
- Test déterministe pour le comportement métier.
- Audit indépendant pour la conformité du candidat.
- Build natif réel pour l’installabilité.
- Runtime smoke réel pour l’usage standalone.
- Hash et artefact pour l’identité de la livraison.

Un fichier, une fonction ou un statut JSON ne constitue pas à lui seul une preuve produit.

## 21. Condition terminale stricte

### Règle permanente
Ne jamais déclarer ChoreScore fini avant que :
- tous les DRC soient `complete` ;
- aucun `mustFixBeforeRelease` ne reste ouvert ;
- l’APK release existe réellement ;
- son SHA-256 soit enregistré ;
- il soit installé et lancé sur API 35 ;
- le réseau du device soit désactivé ;
- Metro ne soit pas requis ;
- onboarding, timer, restart/persistance et navigation cœur soient réellement parcourus ;
- l’artefact soit uploadé ;
- l’attestation finale corresponde exactement à cet artefact.

## 22. Ne jamais affaiblir un gate pour “faire avancer” le run

### Règle permanente
Quand une garde bloque :
1. vérifier si le contrat de la garde est correct ;
2. si oui, corriger le produit ou le build ;
3. si non, corriger la garde en conservant le niveau de preuve voulu.

Supprimer une validation uniquement parce qu’elle est rouge est interdit.

## 23. Le nettoyage GitHub doit être sûr

### Règle permanente
- Ne jamais supprimer le run courant.
- Ne jamais supprimer un successeur utile.
- Purger les vieux runs uniquement après détermination claire du run actif.
- Les anciens workflows supprimés peuvent conserver des runs zombies/queued : les rechercher explicitement et les annuler/supprimer quand possible.
- Le nettoyage ne doit jamais être une seconde orchestration.

## 24. Rapporter l’état avec précision

### Règle permanente
Dans les comptes rendus :
- dire ce qui est **prouvé maintenant**, pas ce qui “devrait” arriver ;
- distinguer `queued`, `in_progress`, `success`, `failure`, `skipped` ;
- ne pas présenter un run en cours comme une réussite future ;
- lorsqu’un nouveau problème apparaît, corriger l’affirmation précédente explicitement.

## 25. Préférer la simplicité cumulative à la sophistication de contrôle

La principale leçon architecturale de toute cette séquence est la suivante :

> Une usine autonome robuste n’est pas celle qui possède le plus de mécanismes de recovery. C’est celle dont l’état accepté est simple, durable, inspectable et reprenable, et dont chaque étape ajoute une preuve vérifiable avant de passer à la suivante.

Pour ChoreScore :

**état accepté unique → agents bornés → audits indépendants → intégration déterministe → Director borné → release native réelle → runtime smoke → attestation.**

Tout mécanisme futur doit être jugé selon une question : **réduit-il réellement le risque ou ajoute-t-il seulement une nouvelle machine d’état susceptible de se contredire avec les autres ?**

## 26. Méthode obligatoire pour toute nouvelle panne

Avant toute correction future :

1. récupérer le run le plus récent ;
2. identifier le premier job réellement fautif ;
3. lire son log complet jusqu’à la première cause déterminante ;
4. vérifier l’état actuel de `lab/chorescore` ;
5. déterminer ce qui a déjà été persisté malgré l’échec ;
6. classer la panne par couche ;
7. vérifier les contrats correspondants dans toutes les sources de vérité ;
8. corriger la cause racine minimale ;
9. préserver toutes les preuves déjà acceptées ;
10. reprendre depuis la phase la plus avancée possible ;
11. ne déclarer la correction réussie qu’après observation du nouveau run au-delà du point de casse précédent.

Ce protocole est plus important que n’importe quelle correction ponctuelle.