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

`.github/workflows/chorescore-loop.yml` reprend la séparation des contextes de
SPIDER en l'adaptant à une application mobile et en ajoutant une relance bornée :

1. le runner mobile et le runner backend partent en parallèle du même commit
   immuable et ne peuvent écrire que dans des périmètres disjoints ;
2. chaque candidat est poussé sur sa propre branche `cycle/<id>/<rôle>` par une
   étape shell de confiance, après validation de tous les chemins modifiés ;
3. un auditeur indépendant reçoit seulement les patches, les traite comme des
   entrées hostiles et produit un rapport sans intégrer de code ;
4. le directeur reçoit les deux candidats et l'audit, corrige ou retire les
   éléments bloquants, réécrit les directives du cycle suivant et produit une
   décision JSON `continue` ou `stop` ;
5. le workflow exécute les contrôles complets et dispose d'une seule tentative
   de réparation fondée sur les logs réels ;
6. une étape shell de confiance met à jour la branche cumulative
   `automation/chorescore-loop` et une unique PR brouillon ;
7. si la décision vaut `continue`, que les checks passent et que la limite n'est
   pas atteinte, cette étape déclenche le workflow suivant avec le
   `GITHUB_TOKEN` éphémère et le commit cumulatif comme nouvelle base.

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

Le workflow est limité aux dépôts privés. Une série démarre manuellement, ou par
un commit d'installation explicite contenant `[run-chorescore-loop]` qui
modifie le workflow. Les pushes ordinaires ne lancent rien. Une série comprend
au maximum six cycles par défaut et huit au maximum ; elle s'arrête plus tôt sur
décision du directeur, échec déterministe, blocage humain ou risque non résolu.
Une nouvelle série peut être lancée manuellement après revue. Sur `main`, les
protections de branche et la revue humaine restent la barrière finale ; la
permission d'écrire des branches ne vaut jamais permission de fusionner.

GitHub autorise explicitement un événement `workflow_dispatch` créé avec le
`GITHUB_TOKEN` à démarrer un nouveau run. Les pushes produits par ce même jeton
ne sont pas utilisés comme mécanisme récursif. Aucune clé personnelle, clé
OpenCode ou GitHub App supplémentaire n'est nécessaire.

La création automatique d'une PR peut dépendre du réglage GitHub autorisant les
Actions à créer des pull requests. Son échec ne doit ni élargir les permissions
ni provoquer une fusion ; la branche cumulative et les rapports restent la
source de revue. Les checks complets sont exécutés dans le directeur avant toute
relance, car les workflows de PR créées avec `GITHUB_TOKEN` peuvent demander une
approbation humaine distincte.

## Pilote d'audit en lecture seule

`.github/workflows/opencode-ox-alpha.yml` n'écoute ni commentaire, ni issue, ni
pull request. Il accepte seulement un déclenchement manuel et un choix fermé
(`review` ou `security-audit`), travaille sur le commit de la branche par défaut,
ne reçoit aucun secret, ne persiste pas les identifiants Git et n'a aucun droit
d'écriture. Le partage OpenCode est désactivé.

L'action GitHub OpenCode n'est pas utilisée, car son enveloppe lancerait sa
propre logique de branche et de PR, incompatible avec l'orchestration auditée de
ChoreScore. L'action locale `.github/actions/setup-opencode` télécharge
l'installateur depuis le commit officiel revu
[`03bba464d46f3eddf74195919b1344aa937f7b11`](https://github.com/anomalyco/opencode/commit/03bba464d46f3eddf74195919b1344aa937f7b11),
vérifie son blob Git attendu, puis installe exclusivement OpenCode `1.18.21` et
contrôle la version obtenue. Cela réduit le risque de dérive de l'installateur ;
le binaire de release reste néanmoins une dépendance externe à réévaluer lors
de toute mise à jour.

Avant une fusion de la PR produite :

1. vérifier les logs et confirmer que le modèle utilisé est
   `opencode/x-preview-f-free` sans autre fournisseur ;
2. activer les protections de `main`, checks CI et revue CODEOWNER ;
3. vérifier les permissions des quatre runners et du pilote `github-auditor`,
   notamment l'absence de push, merge ou déploiement côté agent ;
4. conserver des données exclusivement synthétiques et relire humainement tous
   les changements.

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
