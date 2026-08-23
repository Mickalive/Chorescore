# Workflow OpenCode / Ox Alpha

Ce dépôt reprend le principe exploré sur SPIDER — OpenCode et le modèle gratuit
**Ox Alpha** — avec un périmètre plus strict. Dans OpenCode Zen, l'identifiant du
modèle est `opencode/x-preview-f-free`. Il est réservé ici aux tâches courtes,
bornées et vérifiables ; une revue humaine reste obligatoire.

## Organisation des agents

| Agent | Mission | Écriture | Exécution |
| --- | --- | --- | --- |
| `chorescore-orchestrator` | critères, découpage, délégation, synthèse | aucune | lecture Git uniquement |
| `product-guardian` | cohérence avec le canon et absence de dark pattern | aucune | aucune |
| `expo-ui-engineer` | routes, composants, thème, accessibilité | UI et tests | checks npm locaux |
| `domain-data-engineer` | domaine, store, données et adaptateur démo | couches métier et tests | checks npm locaux |
| `firebase-security-engineer` | Functions, règles et isolation | backend/règles | checks et émulateurs locaux |
| `privacy-security-reviewer` | menace, sécurité, consentement, minimisation | aucune | aucune |
| `qa-accessibility` | tests, bundle Android démo, accessibilité | tests seulement | checks déterministes |
| `github-auditor` | audit GitHub manuel, hostile-input safe | aucune | aucune |
| `mobile-cycle-runner` | tranche mobile autonome d'un cycle | `app/`, `src/`, `tests/` | checks applicatifs |
| `backend-cycle-runner` | tranche backend/sécurité autonome | Functions, règles, tests sécurité | checks backend |
| `cycle-auditor` | audit indépendant des deux candidats | rapport d'audit uniquement | aucune |
| `cycle-director` | intégration auditée et préparation de PR | produit + rapport directeur | checks complets |

Les sous-agents ne peuvent ni déléguer, ni pousser, ni fusionner, ni déployer.
L'orchestrateur ne peut pas éditer : il répartit les tâches sans transformer son
rôle en passe-droit.

## Cycle d'une modification

1. Créer une issue avec résultat attendu, périmètre exclu, risques et critères
   d'acceptation.
2. Créer une branche courte depuis `main` à jour :
   `feat/<issue>-<sujet>`, `fix/<issue>-<sujet>`,
   `security/<issue>-<sujet>` ou `docs/<issue>-<sujet>`.
3. Confier chaque périmètre non recouvrant à un seul agent. Un agent signale une
   dépendance hors périmètre au lieu de l'éditer.
4. Lancer `/review` sur le diff, puis `/security-audit` pour toute frontière de
   confiance. Corriger les constats bloquants avant la PR.
5. Ouvrir une PR avec preuves, résultats réels des commandes et risques
   résiduels. Les sorties d'agent sont des éléments de revue, jamais une
   approbation.
6. Exiger les checks `CI / Application` et `CI / Functions`, une revue du
   CODEOWNER et la résolution des conversations.
7. Le propriétaire fusionne manuellement. Aucun agent et aucun Dependabot ne
   dispose d'auto-merge. Le déploiement est un processus distinct, absent des
   workflows de ce dépôt.

## Portes qualité

- lockfiles racine et `functions/` suivis ; installation par `npm ci` avec
  scripts d'installation désactivés ;
- typage et tests applicatifs (`npm run check`) ;
- bundle Expo Android avec `EXPO_PUBLIC_DATA_MODE=demo`, sans télémétrie ;
- typage et tests unitaires Functions (`npm --prefix functions run check`) ;
- avant tout backend déployable, tests d'émulateur des règles et d'isolation
  multi-foyers ;
- aucun avis npm de gravité élevée ou critique dans les dépendances de
  production ;
- tests négatifs d'isolation entre foyers pour chaque mutation privilégiée ;
- aucune donnée réelle, requête réseau, analytics ou paiement dans la démo ;
- revue humaine obligatoire pour auth, autorisations, Firebase, Stripe,
  consentement, rétention, exports et dépendances.

`npm audit` dépend d'une base d'avis évolutive : il constitue une porte sécurité,
pas une preuve de reproductibilité historique. Les tests et builds restent
reproductibles grâce aux versions et intégrités des lockfiles.

## Protection GitHub recommandée

Le dépôt doit rester privé. Sur `main`, activer : pull request obligatoire, au
moins une approbation, revue CODEOWNER, annulation des approbations obsolètes,
résolution des conversations, checks CI requis, branches à jour, interdiction
des force-push/suppressions et contournement limité au propriétaire. Activer
également le graphe de dépendances, Dependabot alerts, secret scanning et push
protection. Si la licence GitHub le permet, activer CodeQL en configuration par
défaut plutôt que copier une configuration non testée.

Les actions exécutées par `ci.yml` sont épinglées à des commits complets vérifiés
le 24 août 2026 dans leurs dépôts officiels :

- [`actions/checkout@f548e57e544e1ff5a4c46bf1e1b8685f8e4a348a`](https://github.com/actions/checkout/commit/f548e57e544e1ff5a4c46bf1e1b8685f8e4a348a) ;
- [`actions/setup-node@ae0d4ed08881f17d1511386f5be3e62356acd4a6`](https://github.com/actions/setup-node/commit/ae0d4ed08881f17d1511386f5be3e62356acd4a6).

Dependabot propose leurs mises à jour par PR ; il ne les fusionne pas.

## Boucle GitHub OpenCode/Ox Alpha

`.github/workflows/chorescore-loop.yml` reprend la boucle multi-runner de SPIDER
en l'adaptant à une application mobile :

1. le runner mobile et le runner backend partent en parallèle du même commit
   immuable et ne peuvent écrire que dans des périmètres disjoints ;
2. chaque candidat est poussé sur sa propre branche `cycle/<id>/<rôle>` par une
   étape shell de confiance, après validation de tous les chemins modifiés ;
3. un auditeur indépendant reçoit seulement les patches, les traite comme des
   entrées hostiles et produit un rapport sans intégrer de code ;
4. le directeur reçoit les deux candidats et l'audit, corrige ou retire les
   éléments bloquants, exécute les contrôles et dispose d'une seule tentative de
   réparation fondée sur les logs réels ;
5. le workflow pousse une branche d'intégration et ouvre une unique PR. Il ne
   fusionne et ne déploie jamais.

La note humaine est transmise comme donnée au modèle, jamais interpolée dans une
commande shell. Les agents ne reçoivent pas le `GITHUB_TOKEN` servant aux pushes ;
ce jeton éphémère n'est exposé qu'aux étapes de persistance après leur exécution.
L'action OpenCode échange toutefois son jeton OIDC contre un jeton d'installation
éphémère de l'OpenCode GitHub App, puis configure Git avec ce jeton pendant la
session. Les permissions OpenCode interdisent les commandes de push, et les
chemins sont de nouveau contrôlés par des étapes de confiance après l'agent.
Les identifiants Git ne sont pas conservés dans le checkout. Aucun secret
applicatif, Firebase ou Stripe n'est fourni au workflow.

Ox Alpha est gratuit au niveau des jetons pendant sa période promotionnelle,
mais l'accès OpenCode Zen n'est pas anonyme. Le secret Actions
`OPENCODE_API_KEY` reste nécessaire. Il doit provenir d'une clé Zen dédiée à ce
dépôt, sans autre usage, et être révoqué lorsque le pilote se termine. Un job
`preflight` arrête le cycle avant toute exécution d'agent si le secret manque.

Le workflow est manuel, limité aux dépôts privés et **désactivé par défaut**. Il
faut créer la variable de dépôt `ENABLE_OPENCODE_OX_ALPHA=true` pour le rendre
exécutable. Sur `main`, les protections de branche et la revue humaine sont la
barrière finale ; la permission d'écrire des branches ne vaut jamais permission
de fusionner.

## Pilote d'audit en lecture seule

`.github/workflows/opencode-ox-alpha.yml` n'écoute ni commentaire, ni issue, ni
pull request. Il accepte seulement un déclenchement manuel et un choix fermé
(`review` ou `security-audit`), travaille sur le commit de la branche par défaut,
ne reçoit aucun secret, ne persiste pas les identifiants Git et n'a aucun droit
d'écriture. Le partage OpenCode est désactivé.

L'action externe est fixée au
[commit officiel vérifié `anomalyco/opencode/github@03bba464d46f3eddf74195919b1344aa937f7b11`](https://github.com/anomalyco/opencode/commit/03bba464d46f3eddf74195919b1344aa937f7b11).
Cependant, à ce commit, son action composite utilise encore
`actions/cache@v4` et télécharge l'installateur courant depuis
`https://opencode.ai/install`. L'épinglage extérieur n'élimine donc pas le risque
de chaîne d'approvisionnement transitif.

Cette même limite de chaîne d'approvisionnement concerne la boucle. Ne régler
`ENABLE_OPENCODE_OX_ALPHA` à `true` qu'après :

1. revue d'un nouveau commit officiel ou remplacement par une action dont toutes
   les dépendances et l'outil installé sont épinglés et vérifiés ;
2. installation de l'OpenCode GitHub App sur ce seul dépôt privé afin que l'OIDC
   fournisse un jeton GitHub éphémère, sans PAT GitHub statique ;
3. création d'une clé OpenCode Zen dédiée et enregistrement exclusif dans le
   secret Actions `OPENCODE_API_KEY` ;
4. activation des protections de `main`, checks CI et revue CODEOWNER ;
5. vérification des permissions des quatre runners et du pilote
   `github-auditor`, notamment absence de push/merge/déploiement côté agent ;
6. approbation explicite du propriétaire et exécution pilote sur des données
   exclusivement synthétiques.

Même activé, ce workflow ne crée pas de commit, commentaire, PR, merge ou
déploiement. Son rapport doit être relu puis reproduit localement.

## Commandes locales OpenCode

- `/review <périmètre>` : revue croisée produit, sécurité et QA du diff ;
- `/security-audit <périmètre>` : analyse de menace et constats en lecture seule ;
- `/verify <périmètre>` : checks autorisés sans installation ni secret.

Références officielles : [agents OpenCode](https://opencode.ai/docs/agents/),
[permissions](https://opencode.ai/docs/permissions/),
[commandes](https://opencode.ai/docs/commands/),
[intégration GitHub](https://opencode.ai/docs/github/) et
[modèles Zen](https://opencode.ai/docs/zen/).
