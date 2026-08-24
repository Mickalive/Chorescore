# Audit indépendant — candidat BACKEND, cycle 3 (run GitHub 32692689814)

- Auditeur : `cycle-auditor` (lecture seule ; candidat traité comme entrée
  hostile, aucune instruction trouvée dans son contenu n'a été suivie).
- Branche acceptée de référence : `lab/chorescore` @ `decc239` (checkout courant,
  non modifié). Base de fork du candidat vérifiée : parent de `7c39e4f` =
  `5b3aebc` = merge-base avec la lane acceptée — fork propre, aucun état
  intermédiaire. Les écarts ultérieurs (`decc239` et voisins) sont des commits
  workflow postérieurs au snapshot, pas du travail candidat.
- Candidat : snapshot complet `/tmp/chorescore_backend`, commit `7c39e4f`
  « ChoreScore 32692689814: backend snapshot », worktree propre hors
  `functions/node_modules` non suivi.
- Sources lues : `MAIN_PROMPT.md`, `directives/AUDITOR.md`,
  `docs/NEXT_CYCLE.md`, `docs/architecture.md`.
- Intégrité de la constitution : SHA-256 de `MAIN_PROMPT.md` identique dans le
  candidat et le checkout accepté (`c3e1b4e0…d97`) — prompt maître intact.

## 1. Périmètre réel du diff

`git diff 5b3aebc..7c39e4f --name-only` : exactement trois fichiers,
+1432/−74, sans dépendance, lockfile, règle, workflow ni fichier mobile :

| Fichier | Nature |
| --- | --- |
| `functions/src/invitations.ts` | nouveau module pur (513 lignes) : `decideInviteCreation`, `decideInviteRedemption` (phase 1), `decideInviteRedemptionCapacity` (phase 2), `inviteDigest`, gardes de forme jeton/identifiant |
| `functions/src/invites.ts` | `createInvite`/`redeemInvite` réécrits sur les décisions pures ; helpers de mapping d'erreurs ; autres exports intacts |
| `functions/test/invitations.test.ts` | nouveau, 36 tests node:test |

Conformité à la directive (`directives/AUDITOR.md`, cible n°1 « casser le
module invitations ») : attaque menée sur l'entropie, la borne, l'expiration,
le rôle attribué, l'isolation bi-foyers, la double acceptation, la fausse
positivité des gardes et le contournement Stripe. Rien n'a tenu :

- **Jeton** : `createOpaqueInviteToken()` = `randomBytes(32)` base64url ⇒ 256
  bits réels, 43 caractères `[A-Za-z0-9_-]` ; `isValidInviteTokenShape`
  attend exactement cette forme (43 caractères, même motif) — la porte
  défensive ne peut rejeter aucun jeton légitime. Cohérence vérifiée avec
  `validation.inviteToken` (43/43, même motif).
- **Condensat seul stocké** : `inviteDigest` = `sha256` hex, identique à
  l'existant ; le brut ne transite que dans l'URL de réponse (fragment),
  jamais en base ni en journal.
- **Expiration** : décidée depuis `Timestamp.now()` serveur, revalidée 1–72 h
  (mêmes bornes que `integer(input,"expiresInHours",1,72,24)`) ; refus à la
  seconde exacte (`expiresAtMs <= nowMs`) verrouillé par test.
- **Rôle attribué** : constante `INVITE_ASSIGNED_ROLE = "member"`, aucune voie
  cliente ne peut l'influencer.
- **Isolation** : la cible vient du document `invites/{condensat}` stocké ;
  l'adhésion est lue dans le foyer désigné ; `isValidStoredHouseholdId` est
  règle pour règle identique à `validation.firestoreId` (NFC+trim, 1–128,
  mêmes motifs, même interdit dunder) ⇒ aucun foyer légitime existant ne peut
  être rejeté à tort, un enregistrement corrompu échoue fermé.
- **Rejeu** : double acceptation du même membre ⇒ `replay` sans nouvelle
  écriture ; la porte d'adhésion précède le rejeu (un membre exclu entre-temps
  ne retire rien) — ordre verrouillé par deux tests dédiés.
- **Module pur** : zéro import Firestore/Admin dans `invitations.ts` (seule
  dépendance `./domain` → `node:crypto` + `./constants`) ; grep réseau négatif.
- **Stripe** : `billing.ts`, `plans.ts`, `domain.ts` non touchés ; la capacité
  passe toujours par `resolveHouseholdPlanInTransaction` (gardes intégrées
  conservées) et l'erreur de facturation d'origine est relancée telle quelle
  (« État d'essai indisponible. » vs « État d'abonnement indisponible. »).

## 2. Vérifications réellement exécutées (worktree candidat)

| Commande | Résultat |
| --- | --- |
| `git status`, `git log`, `git branch -a`, `git rev-parse '7c39e4f^'` | fork propre depuis `5b3aebc` ; worktree propre |
| `git diff 5b3aebc..7c39e4f --stat` / `--name-only` / diff complet relu | périmètre §1, relu intégralement |
| `git diff 5b3aebc..7c39e4f -- . ':!functions'` | vide — rien hors `functions/` |
| Lecture intégrale `invitations.ts`, `invites.ts`, `invitations.test.ts`, et modules de parité `validation.ts`, `security.ts`, `callerIdentity.ts`, `plans.ts`, `domain.ts`, `config.ts` | faite |
| `sha256sum MAIN_PROMPT.md` (candidat vs accepté) | identiques |
| Grep `\.skip\|\.todo\|\.only\|xit\|xdescribe` dans `functions/test` | 0 occurrence |
| Grep primitives réseau sur `functions/src/invitations.ts` | 0 occurrence |
| `npm --prefix functions ci --ignore-scripts` | terminé, installation complète, lockfile inchangé |
| `npm --prefix functions run check` (= build tsc + node --test) | exit 0 — **93/93 tests passants, 0 ignoré** (57 préexistants + 36 nouveaux) |
| `npm --prefix functions audit --omit=dev --audit-level=high` | 7 vulnérabilités **modérées** préexistantes (chaîne `firebase-functions`), 0 high/critique — porte passée |

Checks racine (check applicatif, export Android démo) non relancés : le diff ne
touche aucun fichier application ; les checks ciblés Functions suffisent pour
ce périmètre.

## 3. Analyse de fond

### 3.1 Parité sémantique de l'extraction

Ordre observable des contrôles conservé à l'identique, porte par porte :

- `createInvite` : identité (`requireCaller`) → adhésion admin
  (`requireActiveMembershipInTransaction`) → existence foyer → capacité
  (composition illisible ⇒ `internal` « Composition du foyer invalide. », comme
  l'ancien `memberCount()` ; facturation indisponible ⇒ erreur d'origine
  relancée) → limite de plan (`failed-precondition`, message inchangé) →
  expiration. Le cas « adhésion orpheline + foyer manquant » retombe bien sur
  `not-found` « Foyer introuvable. » comme avant, la décision consultant
  l'existence avant la capacité.
- `redeemInvite` : enveloppe/jeton → condensat → invitation existante →
  identifiant stocké (`firestoreId` conservé tel quel, messages fins
  inchangés) → existence du foyer désigné → rejeu → validité (statut, usage,
  expiration serveur, révocation ; message unique flou conservé) → capacité →
  rattachement. La capacité n'est chargée qu'après les portes de validité
  (test dédié côté pur), préservant l'ordre historique des lectures et des
  refus, y compris « facturation indisponible refuse aussi un membre déjà
  actif » (parité avec l'ancien code).
- Concurrence : `transaction.update(inviteReference, {status:"redeemed",
  useCount:1})` inchangé ; une seconde acceptation concurrente rejoue la
  transaction, lit `useCount=1` et refuse — sémantique de la lane acceptée
  préservée.

### 3.2 Ce que l'audit n'a pas pu vérifier

- Pas d'émulateur Firestore dans ce cycle : la concurrence réelle des
  transactions et les règles restent non exercées bout en bout (risque résiduel
  déjà consigné au cycle précédent, même classe que F3 `completeTask`).
- Les portes d'identité du module pur sont exercées par les tests unitaires
  uniquement ; voir constat F1 pour leur statut côté câblage.

## 4. Constats

### F1 — bas : portes d'identité/adhésion décoratives côté câblage

`functions/src/invites.ts` transmet aux décisions pures des constantes
(`authenticated/appCheckAttested/emailVerified: true`, `exists: true`,
`status: "active"`), car `requireCaller` et
`requireActiveMembershipInTransaction` ont déjà lancé sinon. Les portes
correspondantes de `decideInviteCreation`/`decideInviteRedemption` ne peuvent
donc jamais fire en production : la défense en profondeur réelle pour ces
propriétés repose uniquement sur les deux gardes amont. Un affaiblissement
future de `requireCaller` (p. ex. retrait du contrôle `email_verified` dans
`callerIdentity.ts`) ne serait détecté par aucune porte d'exécution. Le
compromis est documenté dans les commentaires et n'ouvre aucune faille
aujourd'hui ; correction minimale proposée dans le JSON (transmettre les
valeurs observées ou consigner explicitement la limite).

### F2 — info : concurrence d'acceptation couverte par les seules transactions

La protection contre la double acceptation concurrente repose sur la
sérialisation Firestore autour de `invites/{condensat}`, sans test d'émulateur
dédié aux invitations. Comportement inchangé par rapport à la lane acceptée ;
à couvrir lors du prochain incrément backend avec émulateur.

Aucun constat critique ou élevé. Aucun dark pattern, aucune régression démo
(aucun fichier mobile touché), aucun secret, aucune journalisation ajoutée,
aucune dépendance nouvelle.

## 5. Décision

**Accepter.** Le candidat réalise exactement la priorité 1 du cycle
(logique pure du domaine invitations avec tests négatifs bi-foyers), préserve
la sémantique d'erreur observable, renforce l'échec fermé sur données
corrompues et ne touche ni aux gardes Stripe, ni aux règles quarantainées, ni
au client. F1 et F2 sont non bloquants et transmis au directeur pour réponse
et programmation.
