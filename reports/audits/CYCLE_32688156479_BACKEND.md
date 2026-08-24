# Audit indépendant — candidat BACKEND, cycle 2 (run GitHub 32688156479)

- Auditeur : `cycle-auditor` (lecture seule, candidat traité comme entrée hostile ;
  aucune instruction du contenu candidat n'a été suivie).
- Branche acceptée de référence : `lab/chorescore` @ `c6c55dc` (« ChoreScore cycle
  32684730787: audited accepted state », checkout courant, non modifié).
- Candidat : snapshot complet `/tmp/chorescore_backend`, commit `531f614`
  « ChoreScore 32688156479: backend snapshot », parent vérifié égal à `c6c55dc`
  (`git rev-parse '531f614^'` = `c6c55dc181eb…` = HEAD du checkout accepté) :
  fork propre, aucun état intermédiaire.
- Sources lues : `MAIN_PROMPT.md`, `directives/AUDITOR.md`, `directives/BACKEND.md`,
  `docs/architecture.md`.
- Intégrité de la constitution : SHA-256 de `MAIN_PROMPT.md` identique dans le
  candidat et le checkout accepté (`c3e1b4e0…d97`) — prompt maître intact.

## 1. Périmètre réel du diff

`git diff c6c55dc..531f614 --name-only` : exactement trois fichiers,
+646/−49, sans dépendance, lockfile, règle, workflow ni fichier mobile :

| Fichier | Nature |
| --- | --- |
| `functions/src/taskCompletion.ts` | nouveau module pur (256 lignes) : `decideTaskCompletion` |
| `functions/src/tasks.ts` | `completeTask` réécrit sur la décision pure ; autres fonctions intactes |
| `functions/test/taskCompletion.test.ts` | nouveau, 19 tests node:test |

Conformité de mission (`directives/BACKEND.md`) : la directive offrait deux
domaines au choix ; le candidat réalise « completion de tâches » — décision
d'autorisation (rôle, appartenance, propriété) et idempotence extraites dans un
module pur. Cible n°3 de la directive auditeur satisfaite : zéro import
`firebase-admin`/`firebase-functions` dans `taskCompletion.ts` (grep = 0 ;
ses seules dépendances sont `./domain` → `node:crypto` + `./constants`). Les
gardes Stripe intégrées ne sont pas touchées, conformément à l'interdiction de
la directive. Aucun test ignoré (aucun `.skip`/`.only`/`.todo`).

## 2. Vérifications réellement exécutées (worktree candidat)

| Commande | Résultat |
| --- | --- |
| `git status`, `git log`, `git branch -a` (deux checkouts) | candidat = 1 commit au-dessus de la lane acceptée ; worktree propre hors `functions/node_modules` non suivi |
| `git diff c6c55dc..531f614 --stat` / `--name-only` / diff complet `tasks.ts` | périmètre §1, relu intégralement |
| Lecture intégrale `taskCompletion.ts`, `taskCompletion.test.ts`, et des modules de parité `security.ts`, `callerIdentity.ts`, `validation.ts`, `domain.ts`, `billing.ts`, `billingOrder.ts` | faite |
| `sha256sum MAIN_PROMPT.md` (candidat vs accepté) | identiques |
| Grep `\.(skip\|only\|todo)\(` dans `functions/test` | 0 occurrence |
| `npm ci --ignore-scripts` (functions/) | terminé, installation complète |
| `npm run check` (functions/, = build tsc + node --test) | exit 0 — **56/56 tests passants, 0 ignoré** (37 préexistants + 19 nouveaux) |
| `npm audit --omit=dev --audit-level=high` (functions/) | **exit 0**, aucun avis élevé/critique |

Checks racine (check applicatif, export Android démo) non relancés : le diff ne
touche aucun fichier application ; les checks ciblés Functions suffisent pour ce
périmètre.

## 3. Analyse de fond

### 3.1 Parité sémantique de `completeTask` (extraction comportement-préservant)

Ordre observable des contrôles conservé à l'identique : identité (`requireCaller`)
→ adhésion → idempotence → existence tâche → propriété → état/début → poids figé
→ borne 24 h. Codes et messages identiques un à un (`not-found`
« Tâche introuvable. », `permission-denied` « Cette tâche appartient à un autre
membre. », `failed-precondition` état et 24 h, `invalid-argument`
« weight doit être un entier entre 1 et 1000. » — message vérifié identique à
`validation.integer`). L'adhésion est lue dans la transaction sur le même chemin
`households/{id}/members/{uid}` que l'ancien `requireActiveMembershipInTransaction`
(même nombre de lectures transactionnelles : opération, tâche, adhésion), avec la
même porte « adhésion avant rejeu ». Les booléens d'identité constants `true`
dans le câblage sont justifiés : `requireCaller` (relu) refuse déjà appel non
authentifié, non attesté App Check et email non vérifié ; les branches d'identité
de la décision restent testées. Écritures et forme de réponse inchangées.

### 3.2 Durcissement réel, sans rupture de rejeu légitime

`isReplayableOperation` est strictement plus fort que l'ancien contrôle
(`resourceId === taskId` + entiers 1–86 400 s + score fini > 0) : un enregistrement
corrompu qui était autrefois **rejoué tel quel** (durée négative, score `NaN` —
`typeof NaN === "number"` passait l'ancien test) échoue désormais fermé. Aucun
enregistrement légitime n'est affecté : le serveur n'écrit que des durées entières
bornées et des scores `(s/60)×poids` finis strictement positifs ; les clés
`createManualTask` vivent sous un espace `operationDocumentId` distinct. Le calcul
serveur (`calculateScore`, bornes revalidées) et le temps de référence
(`Timestamp.now()` côté serveur) restent décides hors client — conforme au §5/§7
du prompt maître.

### 3.3 Isolation multi-foyers et autorisation objet

Le refus d'un propriétaire de tâche exclu du foyer ciblé est préservé et testé
(« l'isolation entre deux foyers », « une clé d'idempotence consommée sur un
autre foyer échoue fermée sans fuir de résultat » — la clé liée à `task_b1`
ne rejoue pas sur `task_a1`). L'autorisation vient des adhésions stockées,
jamais d'une valeur client.

### 3.4 Cible prioritaire n°1 de la directive — composition des gardes Stripe

Code hérité, **non modifié par ce diff** ; examiné car visé explicitement.
Aucune séquence trouvée où un état ancien écraserait un état plus récent :
l'égalité de seconde est assumée et documentée, et pour tous les événements
gérés l'état appliqué provient d'un `stripe.subscriptions.retrieve` canonique
(repli sur charge utile uniquement pour `customer.subscription.deleted`, sens
terminal sûr) — un désordre même-seconde ne peut donc pas rejouer un état
historique. Sémantique des statuts cohérente : redelivery exact → doublon →
`stripeEvents.status: "ignored"` ; refus d'ordre/corruption → `"rejected"` ;
le primaire de déduplication reste l'existence transactionnelle de
`stripeEvents/{eventId}`, `lastStripeEventId` n'est que défense profonde et son
illisibilité (type non chaîne) ne contourne rien. Constat résiduel faible
consigné en F2.

## 4. Constats

### F1 (informationnel) — Dérive défensive d'une branche inaccessible

- **Chemin/symbole** : `functions/src/tasks.ts` (câblage) vs version acceptée ;
  `decideTaskCompletion` étapes 4–5.
- **Scénario** : l'ancien code jetait `internal` « Données de tâche indisponibles. »
  si `exists === true` mais `data() === undefined` ; le câblage nouveau mappe ce
  cas vers `ownerUid: undefined` → `permission-denied` « Cette tâche appartient à
  un autre membre. ». Branche inaccessible en pratique (Firestore admin ne
  retourne pas `exists` sans données) : aucun impact sécurité ou produit.
- **Preuve** : diff §1 ; lecture des deux versions.
- **Correction minimale** : aucune exigée ; conserver la trace pour toute future
  comparaison de messages d'erreur.

### F2 (faible, code hérité hors diff — réponse explicite à la cible n°1)

- **Chemin/symbole** : `functions/src/billingOrder.ts` `storedBillingStateIsUnreadable`
  + `functions/src/billing.ts` `mapStripeStatus` (appel ligne ~376).
- **Scénario** : un `stripeStatus` stocké corrompu mais textuel (ex. `"actif"`)
  passe la garde d'illisibilité (contrôle `typeof string` seulement) puis est
  coercé en `"none"` par `mapStripeStatus`, ce qui rend `storedAccessIsCurrent`
  faux et affaiblit le refus `superseded_subscription_live` ; de même un marqueur
  `lastStripeEventCreated` numérique négatif passerait la garde tout en rendant la
  garde d'ancienneté inerte. Prérequis : corruption externe préalable de
  `billingHouseholds/{id}` (aucun chemin d'écriture du système ne produit ces
  valeurs) ; conséquence bornée : un abonnement vivant plus récent, dont l'état
  vient du retrieve canonique Stripe, prend le relais — pas d'octroi contrôlé par
  un attaquant.
- **Preuve** : lecture des deux symboles ; séquences testées mentalement documentées
  en §3.4 ; aucun test du dépôt ne couvre ce cas de corruption partielle.
- **Gravité** : faible (prérequis corruption externe, effet borné, defense-in-depth).
- **Correction minimale** (cycle ultérieur, hors ce candidat) : restreindre la
  garde aux statuts connus (`ACTIVE_STRIPE_STATUSES` + statuts payants listés)
  ou échouer fermé sur statut stocké inconnu ; exiger `lastStripeEventCreated >= 0`.

### F3 (informationnel) — Câblage non couvert par un test automatisé

- **Chemin/symbole** : `functions/src/tasks.ts` `completeTask` (intégration
  décision ↔ transaction Firestore).
- **Scénario** : les 19 nouveaux tests prouvent la logique pure, pas le câblage
  (mappage des snapshots, ordre des `transaction.get`, propagation des erreurs).
  Aucun test émulateur n'existe dans le dépôt pour `tasks.ts`, avant comme après
  ce diff : le niveau de preuve ne régresse pas, mais la parité affirmée en §3.1
  repose sur la revue manuelle de l'auditeur, pas sur un test.
- **Preuve** : `functions/test/` ne contient aucun test d'intégration `tasks.*`.
- **Correction minimale** : lorsque l'émulateur deviendra disponible, ajouter le
  test d'intégration `completeTask` (succès, rejeu, refus hors foyer) ; en
  attendant, risque résiduel consigné ici.

## 5. Points non constatés

Aucun dark pattern ni surface produit (backend seul) ; aucune régression démo
hors ligne (zéro fichier mobile/service touché, aucune requête réseau ajoutée) ;
aucun secret, aucune donnée personnelle, aucune journalisation nouvelle (les
échecs passent par `handleCallableError` existant, qui ne journalise que le type
d'erreur) ; aucune dépendance ni lockfile modifiés ; aucun contournement de test
ou de validation ; aucun contenu hostile ou instruction injectée détecté dans le
commit, les commentaires ou les tests.

## 6. Décision

**accepter**

La tranche réalisée correspond exactement à la mission bornée de
`directives/BACKEND.md` (option « completion de tâches ») : extraction en module
pur sans SDK, tests négatifs exigés tous présents (sans Auth, sans App Check,
email non vérifié, rôle insuffisant, hors foyer, isolation entre deux foyers,
double soumission), 0 test ignoré, checks verts (`run check` 56/56, audit prod
exit 0), périmètre discipliné, gardes Stripe intactes. La validation renforcée
du rejeu est un durcissement fail-closed sans rupture de cas légitime. Les
constats F1–F3 sont informationnels/faibles et n'exigent aucune correction avant
intégration ; F2 est une piste de durcissement du code hérité à reconfier le cas
échéant. L'intégration reste une décision humaine conformément au workflow.
