# Workflow OpenCode / Ox Alpha

Ce dépôt reprend le principe exploré sur SPIDER — OpenCode et le modèle gratuit
**Ox Alpha** — avec un périmètre plus strict. Dans OpenCode Zen, l'identifiant du
modèle est `opencode/x-preview-f-free`. Il est réservé ici aux tâches courtes,
bornées et vérifiables ; une revue humaine reste obligatoire.

`MAIN_PROMPT.md` est la constitution stable commune à tous les rôles. Son
empreinte est épinglée dans le workflow et vérifiée avant chaque appel au
modèle. Les priorités qui doivent évoluer sont séparées sous `directives/` : le
directeur peut réécrire les directives mobile, backend et audit, mais pas son
propre contrat ni le prompt maître.

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
| `cycle-auditor` | audit indépendant d'un snapshot complet | rapport d'audit uniquement | checks ciblés dans le worktree |
| `cycle-director` | intégration dans la branche acceptée et relance | produit + rapport directeur | checks complets |

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

`.github/workflows/chorescore-loop.yml` porte directement l'architecture qui
fonctionne dans SPIDER, adaptée aux frontières mobile/backend de ChoreScore :

1. `lab/chorescore` est l'unique branche acceptée persistante ; chaque cycle en
   hérite et ne repart donc jamais de zéro ;
2. les runners mobile et backend partent en parallèle de cette branche et
   poussent des snapshots complets sous
   `cycle/chorescore/<run>/<rôle>`, même si leur étape agent échoue ;
3. deux auditeurs indépendants montent immédiatement les worktrees complets,
   inspectent les vrais diffs et persistent chacun leur propre rapport ;
4. le directeur s'exécute avec `always()`, monte les quatre snapshots complets
   et travaille directement sur `lab/chorescore` ;
5. il n'intègre que le code qui survit à son audit, peut récupérer un ancien
   backend déjà audité, puis les checks application, export Android et Functions
   valident l'état accepté ;
6. le shell de confiance pousse la branche persistante et un snapshot directeur,
   conserve une unique PR brouillon, puis relance le cycle si la décision JSON
   vaut `continue` ;
7. `max_cycles: 0` signifie que la boucle continue jusqu'à l'arrêt motivé du
   directeur. Une limite positive reste disponible pour un lot borné.

Au démarrage, chaque nouveau cycle supprime les anciens runs GitHub Actions déjà
terminés et remplacés. Les runs actifs et le CI du commit courant sont conservés ;
les branches, commits et rapports produits par les agents ne sont jamais effacés.

Le directeur transmet donc de nouvelles informations par
`directives/MOBILE.md`, `directives/BACKEND.md`, `directives/AUDITOR.md` et
`docs/NEXT_CYCLE.md`. Il ne possède pas le jeton qui effectue le dispatch : le
modèle ne fait qu'écrire une décision validée par `jq`, puis le shell borné
choisit ou non de relancer.

La note humaine est transmise comme donnée au modèle, jamais interpolée dans une
commande shell. Les agents ne reçoivent pas le `GITHUB_TOKEN` servant aux pushes ;
ce jeton éphémère n'est exposé qu'aux étapes de persistance après leur exécution.
OpenCode est appelé directement avec `opencode run`, comme dans la boucle SPIDER :
il ne reçoit donc ni jeton GitHub, ni jeton OIDC, ni clé d'API. Dans la version
OpenCode revue et épinglée, l'absence de `OPENCODE_API_KEY` force l'identifiant
public et désactive les modèles payants ; seul le modèle gratuit explicitement
sélectionné peut être utilisé. Les identifiants Git ne sont pas conservés dans
le checkout. Aucun secret applicatif, Firebase ou Stripe n'est fourni au
workflow.

Le workflow est limité aux dépôts privés. Il démarre manuellement ou par le
bridge `.github/workflows/chorescore-launch.yml` lorsqu'un commit ajoute une
requête validée sous `.chorescore/launch/*.json`. Les pushes ordinaires ne
lancent pas la boucle. Sur `main`, les protections de branche et la revue
humaine restent la barrière finale ; la permission d'écrire des branches ne
vaut jamais permission de fusionner.

GitHub autorise explicitement un événement `workflow_dispatch` créé avec le
`GITHUB_TOKEN` à démarrer un nouveau run. Les pushes produits par ce même jeton
ne sont pas utilisés comme mécanisme récursif. Aucune clé personnelle, clé
OpenCode ou GitHub App supplémentaire n'est nécessaire.

La création automatique d'une PR peut dépendre du réglage GitHub autorisant les
Actions à créer des pull requests. Son échec ne doit ni élargir les permissions
ni provoquer une fusion ; la branche acceptée et les rapports restent la source
de revue. Les checks complets sont exécutés dans le directeur avant toute
relance, car les workflows de PR créées avec `GITHUB_TOKEN` peuvent demander une
approbation humaine distincte.

## Installation et revue OpenCode

L'action GitHub OpenCode n'est pas utilisée, car son enveloppe lancerait sa
propre logique de branche et de PR, incompatible avec l'orchestration auditée de
ChoreScore. L'action locale `.github/actions/setup-opencode` télécharge
l'installateur depuis le commit officiel revu
[`03bba464d46f3eddf74195919b1344aa937f7b11`](https://github.com/anomalyco/opencode/commit/03bba464d46f3eddf74195919b1344aa937f7b11),
vérifie son blob Git attendu, puis installe exclusivement OpenCode `1.18.21` et
contrôle la version obtenue. Le pilote manuel Ox Alpha a été supprimé : les
audits indépendants font désormais partie de chaque cycle autonome.

Avant une fusion de la PR produite, vérifier les logs, les rapports des deux
auditeurs et du directeur, les checks CI, les permissions effectives et
l'absence de données réelles. La fusion et le déploiement restent humains.

## Commandes locales OpenCode

- `/review <périmètre>` : revue croisée produit, sécurité et QA du diff ;
- `/security-audit <périmètre>` : analyse de menace et constats en lecture seule ;
- `/verify <périmètre>` : checks autorisés sans installation ni secret.

Références officielles : [agents OpenCode](https://opencode.ai/docs/agents/),
[permissions](https://opencode.ai/docs/permissions/),
[commandes](https://opencode.ai/docs/commands/),
[intégration GitHub](https://opencode.ai/docs/github/) et
[modèles Zen](https://opencode.ai/docs/zen/).
