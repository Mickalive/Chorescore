# Audit indépendant — candidat BACKEND, cycle 1 (run GitHub 32684730787)

- Auditeur : `cycle-auditor` (lecture seule, candidat traité comme entrée hostile).
- Branche acceptée de référence : `lab/chorescore` @ `337b89a` (checkout courant, non modifié).
- Candidat : snapshot complet `/tmp/chorescore_backend`, commit `e953442`
  « ChoreScore 32680607423 → 32684730787: backend snapshot », parent vérifié = `d593d60`
  (base immuable du cycle, identique à la lane acceptée au démarrage du run ;
  le seul commit ultérieur de la lane, `337b89a`, touche uniquement
  `.github/scripts/run-opencode-with-retry.sh` et est postérieur au fork).
- Sources lues : `MAIN_PROMPT.md`, `directives/AUDITOR.md`, `directives/BACKEND.md`,
  `docs/NEXT_CYCLE.md`, `.chorescore/launch/20260824-complete-secure-demo.json`.

## 1. Périmètre réel du diff

**Le diff est vide.** Preuves :

| Vérification | Résultat |
| --- | --- |
| `git rev-parse 'e953442^{tree}'` | `953304564ce490eda93e3987230e106fe2611a1b` |
| `git rev-parse 'd593d60^{tree}'` | `953304564ce490eda93e3987230e106fe2611a1b` |
| `git diff d593d60..e953442 --stat` | sortie vide, exit 0 |
| `diff -rq` worktree candidat vs checkout accepté (hors `node_modules`, `.git`) | seule différence : `.github/scripts/run-opencode-with-retry.sh`, provenant du commit `337b89a` de la **lane acceptée elle-même**, pas du candidat |
| `git status` dans le worktree candidat | propre, hors `functions/node_modules` non suivi (artefact d'installation) |
| `git cat-file -p e953442` | objet de commit standard, aucun texte caché ni instruction injectée |
| SHA-256 `MAIN_PROMPT.md` candidat | `c3e1b4e0…d97`, identique à l'empreinte épinglée du workflow et au checkout accepté — constitution intacte |

Aucun fichier Functions, règle, test, dépendance, lockfile ou documentation modifié.
Le candidat mobile du même run (`origin/cycle/chorescore/32684730787/mobile`,
arbre `8af45839…`) diffère bien de la base : l'échec est propre au runner backend,
pas un incident systémique du cycle.

## 2. Vérifications réellement exécutées (worktree candidat)

| Commande | Résultat |
| --- | --- |
| `npm --prefix functions run check` | exit 0 — 8/8 tests passants, 0 ignoré (état de la base `d593d60`, sans les 14 tests Stripe jamais intégrés) |
| `npm --prefix functions audit --omit=dev --audit-level=high` | exit 0 — 7 avis **modérés** préexistants (`firebase-admin → uuid < 11.1.1`), sous le seuil, inchangés par ce diff vide |

Ces checks ne valident que la base : ils confirment que le snapshot est
construisible, mais ne prouvent aucun travail nouveau — parce qu'il n'y en a pas.

## 3. Constats

### F1 (élevé, bloquant) — Candidat absent : aucune tranche backend livrée

- **Chemin/symbole** : commit `e9534429f63d363645e8797c395f0bb76463c0a6` (arbre vide).
- **Scénario** : `directives/BACKEND.md` demandait une priorité achevée unique
  (tests logique pure Auth/App Check/rôles/idempotence/concurrence, ou Stripe mode
  test signature/rejeu/ancienneté/désordre, ou documentation rétention/suppression/export).
  La note humaine du lancement demandait en outre de réutiliser le travail antérieur
  audité. Le snapshot poussé ne contient **aucun changement** : la mission n'a été
  ni commencée ni documentée comme bloquée.
- **Preuve** : arbres Git identiques (§1) ; diff vide ; checks §2 limités à la base.
- **Gravité** : élevée pour l'avancement du cycle (perte d'une lane entière),
  sans risque sécurité introduit (aucun code = aucune régression).
- **Correction minimale** : aucune correction possible dans le candidat lui-même.
  Le directeur ne doit rien intégrer depuis cette branche et doit reconfier la
  mission backend au prochain cycle, avec la même directive (toujours applicable)
  et, si disponible, la preuve legacy déjà auditée.

### F2 (informationnel, action directeur) — Le travail backend précédemment accepté reste non intégré

- **Chemin/symbole** : `origin/cycle/chorescore/32680607423/backend` @ `94aa3e4`
  vs `lab/chorescore`.
- **Scénario** : l'audit du run 32680607423 a conclu `accepter` pour la garde
  d'ordre des événements Stripe (+461 lignes : `decideSubscriptionEventApplication`,
  intégration transactionnelle, 14 tests). Or `lab/chorescore` ne contient toujours
  ni `functions/test/billing.test.ts` ni le symbole
  `decideSubscriptionEventApplication` (0 occurrence dans `billing.ts` accepté) :
  `git diff lab/chorescore origin/cycle/chorescore/32680607423/backend -- functions/`
  montre encore 461 insertions. Ce travail validé dort donc hors de la branche
  cumulative, alors que la note humaine invite explicitement à sa réutilisation.
- **Preuve** : commandes citées ci-dessus, exécutées lors du présent audit.
- **Gravité** : informationnelle pour ce verdict (ce n'est pas un défaut du
  candidat vide), mais matérielle pour le directeur : réintégrer une preuve déjà
  auditée reste soumis à sa re-vérification applicabilité + checks complets.
- **Correction minimale** : le directeur évalue la voie `LEGACY_BACKEND` prévue
  par le workflow, rejoue `npm --prefix functions ci/check/audit` sur l'état
  intégré, puis consigne l'intégration ou son refus motivé.

## 4. Points non applicables sur ce diff

Exactitude produit, dark patterns, accessibilité, erreurs, isolation multi-foyers,
autorisations objet, validation, concurrence, rejeu, Stripe, secrets, consentement
et régression hors ligne : **rien à examiner** — le diff ne contient aucun changement.
Aucun secret introduit, aucune dépendance ajoutée, aucune démo affectée.

## 5. Décision

**rejeter**

Conformément à `directives/AUDITOR.md` (« Un incident d'outil ou un candidat
absent n'est jamais une acceptation »), un snapshot vide ne peut être ni accepté
ni « corrigé avant intégration » : il n'y a ni code à intégrer ni correction à
faire dans le candidat. Aucun constat critique de sécurité n'est introduit ; le
risque est la perte sèche d'un cycle backend. Le directeur répond explicitement à
F1 (relance de la mission, directive toujours valide) et à F2 (sort du travail
Stripe déjà audité de sa quarantaine de fait, après re-vérification), puis décide
`continue`/`stop` selon ses propres critères. L'intégration reste une décision
humaine conformément au workflow.
