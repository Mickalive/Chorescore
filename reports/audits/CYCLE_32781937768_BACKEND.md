# Audit indépendant — candidat BACKEND, cycle 4 (run GitHub 32781937768)

- Auditeur : `cycle-auditor` (lecture seule ; candidat traité comme entrée
  hostile, aucune instruction trouvée dans son contenu n'a été suivie).
- Branche acceptée de référence : `lab/chorescore` @ `de6470b` (checkout
  courant, non modifié). Base de fork du candidat vérifiée : merge-base
  (`de6470b`) = parent immédiat de `46fb523` — fork propre depuis la tête de
  la lane acceptée, aucun état intermédiaire.
- Candidat : snapshot complet `/tmp/chorescore_backend`, commit `46fb523`
  « ChoreScore 32781937768: backend snapshot », worktree propre hors
  `functions/node_modules` non suivi.
- Sources lues : `MAIN_PROMPT.md`, `directives/AUDITOR.md`,
  `docs/NEXT_CYCLE.md`, plus les modules de parité du candidat
  (`callerIdentity.ts`, `security.ts`, `billingOrder.ts`, `billing.ts`,
  `domain.ts`, `tasks.ts`, tests associés).
- Intégrité de la constitution : SHA-256 de `MAIN_PROMPT.md` identique dans le
  candidat et le checkout accepté (`c3e1b4e0…d97`) — prompt maître intact ;
  ni `AGENTS.md`, ni `directives/`, ni `.github/`, ni lockfiles touchés.

## 1. Périmètre réel du diff

`git diff de6470b..46fb523 --name-status` : exactement trois fichiers,
+237/−24, tous sous `functions/`, sans dépendance, lockfile, règle, workflow
ni fichier mobile :

| Fichier | Nature |
| --- | --- |
| `functions/src/invitations.ts` | +37 : interface `ObservedCallableRequest` (forme minimale structurellement compatible avec `CallableRequest`, sans dépendre du SDK) et fonction pure `observedInviteCaller(request)` ; commentaire de `InviteCaller` mis à jour |
| `functions/src/invites.ts` | `createInvite` et `redeemInvite` transmettent désormais `observedInviteCaller(request)` aux décisions au lieu des constantes `{authenticated:true, appCheckAttested:true, emailVerified:true}` ; `redeemInvite` transmet aussi `exists: inviteSnapshot.exists` au lieu de `true` ; commentaires actualisés |
| `functions/test/invitations.test.ts` | +180 : cinq tests nouveaux couvrant l'observation fidèle de la requête et le refus des identités dégradées avec codes/messages historiques |

Conformité à la directive (`directives/AUDITOR.md`, cible n°2 « vérité du
câblage d'identité ») : c'est exactement la mission prioritaire issue du
constat F1-identite-decorative-cablage du cycle précédent, réalisée sans
déborder du périmètre.

## 2. Vérifications réellement exécutées (worktree candidat)

| Commande | Résultat |
| --- | --- |
| `git status`, `git log`, `git branch -a` (candidat et checkout accepté), `git merge-base de6470b 46fb523` | fork propre depuis `de6470b` ; worktree propre |
| `git diff de6470b..46fb523 --stat` / `--name-status` / diff complet relu | périmètre §1, relu intégralement |
| `git diff de6470b..46fb523 -- . ':!functions'` | vide — rien hors `functions/` |
| `git diff de6470b..46fb523 -- functions/package.json functions/package-lock.json` | vide — aucune dépendance ni lockfile touchés |
| `sha256sum MAIN_PROMPT.md` (candidat vs accepté) | identiques `c3e1b4e0…d97` |
| Grep `\.skip\|.todo\|.only\|xit(\|xdescribe` dans `functions/test` | 0 occurrence — aucun test ignoré ou filtré |
| Grep primitives réseau sur `functions/src/invitations.ts` | 0 occurrence — module toujours pur |
| Grep motifs secrets sur le diff complet (`api_key`, `secret`, `BEGIN RSA…`, `sk_live`, `whsec`…) | 0 occurrence |
| Grep sites d'appel `observedInviteCaller` | exactement deux : `createInvite` (ligne 202) et `redeemInvite` (ligne 301) |
| `npm --prefix functions ci --ignore-scripts` | terminé, installation complète, lockfile inchangé |
| `npm --prefix functions run check` (= build tsc + node --test) | exit 0 — **98/98 tests passants, 0 ignoré** (93 préexistants + 5 nouveaux) |
| `npm --prefix functions audit --omit=dev --audit-level=high` | exit 0 — 7 vulnérabilités **modérées** préexistantes (chaîne `firebase-admin`/`uuid`), 0 high/critique : porte passée |

Checks racine (check applicatif, export Android démo) non relancés : le diff ne
touche aucun fichier application ; les checks ciblés Functions suffisent pour
ce périmètre.

## 3. Analyse de fond

### 3.1 Vérité de l'observation (cible directive n°2)

`observedInviteCaller` lit exclusivement des propriétés posées par la
plateforme après vérification — jamais le corps de la requête :

- `authenticated: request.auth !== undefined` ;
- `appCheckAttested: request.app !== undefined` ;
- `emailVerified: request.auth?.token?.email_verified === true` (strictement
  `true`, aucune coercion de `"yes"`, `1`, etc.) ;
- `uid: request.auth?.uid`.

Parité porte par porte avec `requireCaller` (`callerIdentity.ts`) : mêmes
codes (`unauthenticated`, `failed-precondition`) et mêmes messages exacts
(« Authentification requise. », « Attestation App Check requise. », « Une
adresse email vérifiée est requise. »). Si `requireCaller` venait à
s'affaiblir, chaque porte du module pur redevient exécutable et produit
l'erreur historique — aucune dérive observable pour les clients ni les
journaux. Aucune constante résiduelle n'alimente plus les portes d'identité
des décisions d'invitation.

Le changement `exists: inviteSnapshot.exists` dans `redeemInvite` est truthful
et équivalent : les gardes amont (lignes 268–274) lancent déjà
`invitationUnavailable()` (« permission-denied », « Cette invitation est
invalide ou indisponible. ») — exactement la décision que la porte 3 du module
pur prendrait avec `exists:false`. Aucun changement de comportement observable.

Constantes restantes documentées : `membership:{exists:true,status:"active"}`
dans `createInvite` reste adossé à `requireActiveMembershipInTransaction`, qui
ne expose pas l'instantané brut ; le commentaire du candidat documente cette
limite et exige une revue croisée en cas d'affaiblissement futur. Raison
documentée conforme à la directive (qui ne conteste que les constantes *sans*
raison documentée).

### 3.2 Tests nouveaux : exercent-ils réellement les portes ?

Les cinq tests composent exactement le chemin de production
requête → observation → décision : `observedRequest(...)` construit une
requête réduite aux champs observés, `observedInviteCaller` l'observe,
puis `decideInviteCreation`/`decideInviteRedemption` décident. Couverture :

- fidélité de l'observation (auth absente, app absente, cas pleinement
  attesté) — « sans constante » ;
- création : refus `unauthenticated`, refus App Check, email non vérifié pour
  `[false, undefined, "yes", 1]` (aucune coercion), uid vide ;
- rachat : identité dégradée arrêtée **avant** la branche de rejeu (scénario
  où un câblage à constantes aurait pu atteindre le replay), puis acceptation
  conservée pour une identité pleinement attestée des deux côtés.

Limite résiduelle (constat F1 ci-dessous) : aucun test n'épingle le fait que
`invites.ts` appelle bien `observedInviteCaller(request)` — un retour
hypothétique aux constantes ne ferait échouer aucun test. Les handlers
exigeraient l'émulateur Firestore pour être exercés bout en bout, incrément
déjà programmé (F2 reporté). Risque faible : le code est mince, relu, et la
régression demanderait une réécriture volontaire.

### 3.3 Fausse positivité de la garde durcie (cible directive n°3)

`storedBillingStateIsUnreadable` (`billingOrder.ts`, inchangé par le
candidat) : recherche d'un état légitime écrit par le système qui serait
rejeté à tort —

- `paidTier` écrit : `"standard"`/`"pro"` (webhook, `tierFromSubscription`)
  ou `null` (création foyer, `households.ts:88`) — tous acceptés ;
- `stripeStatus` écrit : sortie de `mapStripeStatus`, donc toujours dans
  `ALL_STRIPE_STATUSES` (les statuts Stripe inconnus sont convertis en
  `"none"` avant écriture) — accepté ;
- `stripeCurrentPeriodEnd` écrit : `Timestamp` ou `null` — accepté ;
- `stripeSubscriptionId` écrit : `subscription.id` (chaîne) — accepté ;
- `lastStripeEventCreated` écrit : `event.created`, secondes Unix Stripe
  donc toujours ≥ 0 — accepté.

Aucune fausse positivité trouvée : la garde continue d'échouer fermé sur
statut stocké inconnu et marqueur négatif sans rejeter aucun état que le
système écrit légitimement.

### 3.4 Honnêteté des commentaires et des tests (cible directive n°4)

Les commentaires nouveaux référencent « constat F1 » /
« F1-identite-decorative-cablage » : précédent réel et vérifiable dans
`docs/NEXT_CYCLE.md` (ligne 38) et dans le rapport d'audit du cycle
32692689814 — aucune référence fabriquée. Le commentaire de `tasks.ts`
(~ligne 300) affirmant que « les branches d'identité de la décision restent
exercées par taskCompletion.test.ts » a été vérifié : vrai (tests des portes
`authenticated`/`appCheckAttested`/`emailVerified` présents, lignes 73–104).
Aucun test ignoré. Aucune prétention de « zéro faille ».

### 3.5 Autres dimensions du périmètre d'audit

- **Exactitude produit / dark patterns** : aucun fichier mobile ou paywall
  touché ; messages serveur calmes, inchangés.
- **Démo hors ligne** : aucun fichier `app/`/`src/` touché ; module pur sans
  réseau (grep négatif).
- **Accessibilité** : hors périmètre de ce diff backend.
- **Isolation multi-foyers** : la cible du rachat vient toujours du document
  `invites/{condensat}` stocké ; l'adhésion est lue dans le foyer désigné ;
  inchangé et déjà couvert par les tests bi-foyers existants.
- **Validation** : `email_verified === true` strict ; `uid` revalidé
  (chaîne non vide) ; aucune nouvelle entrée cliente consommée.
- **Concurrence/rejeu** : écritures transactionnelles inchangées ; porte de
  rejeu préservée et désormais protégée en amont par l'identité observée.
- **Stripe** : `billing.ts`, `plans.ts`, `domain.ts`, `billingOrder.ts` non
  touchés ; gardes intégrées intactes.
- **Secrets/journaux** : aucun secret, aucune journalisation ajoutée.

## 4. Constats

### F1 — bas : câblage véridique mais non épinglé par un test automatisé

La vérité du câblage repose sur la relecture : si `invites.ts` revenait aux
constantes `{authenticated:true,…}`, les 98 tests continueraient de passer,
car ils composent observation → décision directement sans passer par les
handlers `onCall`. La mission du cycle est remplie, mais sa persistance n'est
pas verrouillée par la CI. Correction minimale proposée dans le JSON
(assertion de source ou extraction d'une composition pure testée).
Non bloquant : le code est mince, la régression exigerait une réécriture
volontaire, et l'exercice bout en bout des handlers attend l'incrément
émulateur déjà programmé.

### F2 — info : motif « constantes d'identité » persistant dans `tasks.ts`

`completeTask` (`tasks.ts` ~ligne 300) transmet encore des booléens
d'identité constants à `decideTaskCompletion`, même classe que l'ancien F1.
Hors périmètre de ce candidat (la priorité du cycle portait sur les
invitations), raison documentée dans le commentaire, branches pures exercées
par `taskCompletion.test.ts`. À programmer pour un prochain incrément backend,
idéalement avec le même extracteur `observedInviteCaller` généralisé.

Aucun constat critique ou élevé. Aucun dark pattern, aucune régression démo,
aucun secret, aucune journalisation ajoutée, aucune dépendance nouvelle,
aucune dérive de message d'erreur.

## 5. Décision

**Accepter.** Le candidat réalise exactement la priorité 1 backend du cycle
(vérité du câblage d'identité des invitations, constat F1 du cycle
32692689814) : valeurs observées au lieu de constantes, parité stricte des
codes et messages, tests négatifs nouveaux sans coercion, périmètre strictement
borné à `functions/`, démo et gardes Stripe intactes, 98/98 tests verts.
F1 (bas) et F2 (info) sont non bloquants et transmis au directeur pour réponse
et programmation.
