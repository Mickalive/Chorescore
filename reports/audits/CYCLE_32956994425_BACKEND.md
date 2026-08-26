# Audit indépendant — candidat BACKEND, cycle 4 (run GitHub 32956994425)

- Auditeur : poste immuable `governance/roles/INDEPENDENT_RELEASE_AUDITOR.md`
  (lecture seule ; le candidat est une entrée hostile — aucune instruction
  trouvée dans son contenu n'a été suivie ; aucune correction produite).
- Branche acceptée de référence : `lab/chorescore` @ `33cd4ac` (checkout
  courant, non modifié). Base de fork vérifiée : parent immédiat du candidat
  `af3f0c9` = `33cd4acd…` = HEAD accepté — fork propre depuis la tête de la
  lane acceptée.
- Candidat : snapshot complet `/tmp/chorescore_backend`, commit `af3f0c9`
  « ChoreScore 32956994425: merge backend candidate slices », worktree propre
  hors `functions/node_modules` non suivi. Branche candidat trouvée : oui
  (`origin/cycle/chorescore/32956994425/backend[-full]`, contenu identique :
  même diff 7 fichiers contre `33cd4ac`).
- Sources lues : `MAIN_PROMPT.md`, `governance/RELEASE_DEFINITION.json`,
  `docs/RELEASE_STATUS.json`, `directives/TASKS.json`,
  `directives/AUDITOR.md`, `directives/BACKEND.md`, `docs/NEXT_CYCLE.md`,
  puis les modules candidats (`callerIdentity.ts`, `invitations.ts`,
  `invites.ts`, `tasks.ts`, `taskCompletion.ts`, tests associés) et les audits
  antérieurs cités par ses commentaires (`CYCLE_32781937768_BACKEND.*`).
- Intégrité : SHA-256 de `MAIN_PROMPT.md` identique candidat/accepté
  (`c3e1b4e0…d97`) ; aucun fichier hors `functions/` dans le diff
  (`git diff 33cd4ac..af3f0c9 -- . ':!functions'` vide) donc gouvernance,
  workflows, manifeste d'immuabilité, lockfiles et client mobile intacts.

## 1. Périmètre réel du diff

`git diff 33cd4ac..af3f0c9 --stat` : exactement 7 fichiers, +302/−77, tous
sous `functions/src/**` et `functions/test/**` (~5 fichiers annoncés, 7 réels,
≤ ~12 tolérés) :

| Fichier | Nature |
| --- | --- |
| `functions/src/callerIdentity.ts` | +51 : extraction partagée `observedCaller(request)` (+ interfaces `ObservedCallableRequest`, `ObservedCallerIdentity`) déplacée depuis `invitations.ts` vers le module d'identité, pour servir les invitations **et** `completeTask` |
| `functions/src/invitations.ts` | −48/+11 : suppression des définitions locales désormais dupliquées ; `InviteCaller` devient alias structurel de `ObservedCallerIdentity` ; aucune logique de décision touchée |
| `functions/src/invites.ts` | les deux sites (`createInvite`, `redeemInvite`) appellent `observedCaller(request)` au lieu de `observedInviteCaller(request)` ; commentaires actualisés |
| `functions/src/tasks.ts` | `completeTask` transmet `observedCaller(request)` à `decideTaskCompletion` au lieu des constantes `{authenticated:true, appCheckAttested:true, emailVerified:true, uid:caller.uid}` (constat F2 du cycle 32781937768) |
| `functions/test/invitations.test.ts` | renommage pur de symbole (imports) ; mêmes tests, aucun affaiblissement |
| `functions/test/taskCompletion.test.ts` | +127 : quatre tests nouveaux empruntant le chemin de production requête → observation → décision |
| `functions/test/wiring.test.ts` | nouveau, +86 : épinglage du câblage par assertion sur la source livrée (constat BE-C4-F1) |

Conformité à la mission (`directives/TASKS.json`, backend DRC-07) : c'est
exactement BE-C4-F1 + BE-C4-F2, sans slice ni refactor spéculatif — le
déplacement de l'extracteur est le minimum nécessaire pour partager la même
observation entre invitations et tâches. Aucune dépendance, aucun lockfile,
aucun service réel (`firebase.json`, règles et configuration intacts ;
`enforceAppCheck: true` conservé sur `completeTask`), échec fermé production
préservé.

## 2. Vérifications réellement exécutées

Sur copie jetable `/tmp/opencode/be_audit` (candidate jamais édité ; copie
restaurée à l'identique puis supprimée, `git status` candidat propre) :

| Commande / contrôle | Résultat |
| --- | --- |
| `git log/format/branch -a`, merge-base implicite par lecture des parents | base `33cd4ac` = HEAD accepté ; refs candidat cohérentes |
| `sha256sum MAIN_PROMPT.md` (candidat vs accepté) | identiques `c3e1b4e0…d97` |
| Diff complet relu + pathspec hors `functions/` | vide hors périmètre |
| Diff `functions/package.json` + `functions/package-lock.json` | vide — zéro dépendance/lockfile |
| Grep `.skip/.only/.todo/xit(/xdescribe/console.*/fetch(/http(s)://` sur le diff | 0 occurrence |
| Grep motifs secrets (`api_key`, `secret`, `BEGIN … PRIVATE`, `sk_live`, `whsec`) | 0 occurrence |
| Grep littéraux `authenticated: true` etc. dans `functions/src` | 0 occurrence — plus aucune identité constante côté serveur |
| `npm run build` (tsc strict, `exactOptionalPropertyTypes`…) | exit 0 |
| `node --test lib/test/*.test.js` | **105/105 passants, 0 ignoré** (98 préexistants + 4 taskCompletion + 3 wiring) |
| `npm audit --omit=dev --audit-level=high` | exit 0 — 7 vulnérabilités **modérées** préexistantes (chaîne `firebase-admin`/`uuid`), 0 high/critique |

Checks larges (check applicatif mobile, export Android démo, cohérence) non
relancés : préflight déterministe distinct déjà en exécution parallèle, et le
diff ne touche aucun fichier application.

### Preuves de mutation (copie jetable, candidat intact)

Le contrat BE-C4-F1 exige qu'un retour aux constantes soit détecté. Trois
mutations volontaires, chacune suivie de `build` + exécution ciblée :

1. **M1 — `tasks.ts` revenu aux constantes** (`caller: {authenticated: true,
   …}`) : `wiring.test.js` rouge — `0 !== 1` (« tasks.ts doit alimenter
   decideTaskCompletion avec observedCaller(request) »). Exactement 1 échec.
2. **M2 — un seul site d'invitation revenu aux constantes, avec commentaire
   leurre contenant `observedCaller(request)`** pour tenter de masquer la
   régression : `wiring.test.js` rouge sur le test createInvite/redeemInvite
   (comptage 1 ≠ 2 **et** détection du littéral `authenticated: true`). Le
   masquage par commentaire ne passe pas.
3. **M3 — extracteur partagé rendu constant** (cesse de lire la requête,
   retourne `{true,true,true,"user_1"}`) : 5 échecs comportementaux — fidélité
   de l'observation, refus des identités dégradées en création et rachat
   d'invitation, refus avant rejeu côté tâche, et propriété cross-user (l'uid
   constant fait aboutir user_2 à tort). Restauration : 105/105 vert.

Matrice complète : retrait, retrait partiel, masquage et extracteur aveugle
sont détectés. Le test d'épinglage mord réellement.

## 3. Analyse de fond

### 3.1 BE-C4-F1 — épinglage du câblage

Sans émulateur Firestore, les handlers `onCall` ne sont pas exerçables bout en
bout ; le candidat épingle donc le maillon resté muet par assertion sur la
source réelle livrée : exactement deux `observedCaller(request)` dans
`invites.ts`, exactement un dans `tasks.ts`, aucun littéral d'identité
constante dans ces deux fichiers, et présence des lectures plateforme dans
`callerIdentity.ts`. Les motifs sont insensibles aux espaces (résistants au
reformatage). La direction d'échec est sûre : toute régression « retour aux
constantes » retire nécessairement l'appel, donc fait tomber le comptage —
prouvé par M1/M2. Les motifs d'échec faux (commentaire futur citant l'appel,
renommage de variable) sont pénalisants mais fermés, jamais permissifs.

Le renommage `observedInviteCaller` → `observedCaller` (extracteur mutualisé)
est une dérive de nom assumée et justifiée par BE-C4-F2 (même observation pour
les deux domaines) ; l'alias `InviteCaller = ObservedCallerIdentity` conserve
la compatibilité compile-time (tsc strict vert). L'esprit du constat — « un
retour aux constantes doit être détecté » — est satisfait et prouvé.

### 3.2 BE-C4-F2 — identité observée dans `completeTask`

`requireCaller` reste appelé en amont, inchangé (Auth + App Check + email
vérifié + displayName) ; la décision reçoit désormais l'identité observée sur
la requête brute plutôt que des booléens supposés acquis. En production les
valeurs coïncident (comportement observable inchangé, mêmes codes/messages) ;
si `requireCaller` s'affaiblissait, les portes 1 de `decideTaskCompletion`
refusent avec les codes historiques — défense profonde redevenue réelle.
L'uid passé à la décision (`request.auth?.uid`, typé `unknown`) est la même
valeur que `caller.uid` et reste revalidé (chaîne non vide) ; en cas de
divergence hypothétique, le refus prime (fermé).

Tests négatifs nouveaux entre **deux foyers** explicites :

- cross-foyer : requête pleinement attestée visant le foyer B où user_1 n'a
  plus d'adhésion (tâche pourtant à son nom) → `permission-denied « Accès au
  foyer refusé. »` — l'adhésion lue dans le foyer ciblé fait foi ;
- cross-user : foyer B, user_2 membre actif, tâche appartenant à user_1 →
  `permission-denied « Cette tâche appartient à un autre membre. »`, avec
  contrôle positif symétrique (user_1 complète la sienne) ;
- identités dégradées (sans Auth, sans App Check, email non vérifié pour
  `[false, undefined, "yes", 1]` sans coercion) refusées **avant** la branche
  de rejeu idempotent ;
- complétion nominale conservée (`{complete, 60 s, score 3}`).

Aucun affaiblissement de test existant : `invitations.test.ts` ne change que
de symbole importé ; `taskCompletion.test.ts` n'ajoute que des tests.

### 3.3 Autres dimensions

- **Isolation/autorisation** : ordre des portes inchangé (identité → adhésion
  → idempotence → existence → propriété → état → poids → durée) ; écritures
  transactionnelles et clés d'idempotence intactes.
- **Honnêteté** : les commentaires citent des constats réels et vérifiables
  (F1-identite-decorative-cablage cycle 32692689814 ; F2-constantes-identite-tasks
  documenté dans `CYCLE_32781937768_BACKEND.json`). Aucun placeholder, aucune
  prétention de sécurité absolue, aucun réseau, aucun secret, aucune
  journalisation ajoutée.
- **Démo/accessibilité** : hors périmètre (zéro fichier `app/`, `src/`,
  `tests/`).
- **Stripe/analytics** : modules non touchés, gardes intégrées intactes.

## 4. Constats (aucun bloquant)

### B1 — info : la preuve de mutation BE-C4-F1 n'est pas tracée dans le snapshot

L'acceptation `directives/TASKS.json` mentionne « preuve de mutation fournie
par le codeur » et `directives/BACKEND.md` exige qu'elle soit « tracée » ;
aucun rapport codeur n'accompagne le candidat (convention du dépôt : les
preuves de mutation sont tracées par les rapports d'audit). Le défaut est
comblé par la présente audit : les mutations M1/M2/M3 (§2) démontrent
indépendamment que le test d'épinglage échoue dans les trois scénarios de
régression. Aucune correction du produit n'est requise ; il appartient au
directeur de référencer ce rapport comme traçage de la preuve dans l'état de
livraison. `mustFix: false`.

### B2 — info : limites connues de l'épinglage par scan de source

L'assertion porte sur la source, faute d'émulateur (incrément déjà programmé
et tracé au cycle 32781937768) : le comptage exact échouera à tort sur des
changements bénins (commentaire citant `observedCaller(request)`, renommage de
la variable `request`), et la troisième assertion (présence de chaînes dans
`callerIdentity.ts`) est documentaire — mais c'est alors le filet
comportemental qui mord, comme prouvé par M3 (5 rouges). Une sabotage
délibéré conservant le texte de l'appel tout en altérant sa sémantique
n'est détectable que par l'exercice bout en bout des handlers, limite
résiduelle consignée et non aggravée par ce candidat. Durcissement facultatif :
exclure les commentaires du balayage des littéraux. `mustFix: false`.

Aucun constat critique ou élevé. Aucune régression, aucun dark pattern, aucun
secret, aucune dépendance, aucun service réel, aucun fichier hors périmètre.

## 5. Décision

**Accepter** (round 1, zéro `mustFix`). Le candidat réalise intégralement la
mission backend du cycle : BE-C4-F1 avec preuve de mutation indépendante
(rouge dans les trois scénarios), BE-C4-F2 avec refus négatifs bi-foyers
cross-foyer et cross-user, 105/105 tests verts, audit production sans
high/critique, périmètre strictement `functions/`, constitution et gardes
intactes. Les deux constats info sont transmis au directeur pour réponse et
traçage, sans condition d'intégration.
