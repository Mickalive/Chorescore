# Audit backend — cycle 32961708279 (round 1)

- **Poste** : auditeur indépendant de livraison (`governance/roles/INDEPENDENT_RELEASE_AUDITOR.md`).
- **Candidat** : branche `origin/cycle/chorescore/32961708279/backend`, commit `90ef1a6`
  (« merge backend candidate slices »), parent unique `33cd4ac` = HEAD de la
  branche acceptée `lab/chorescore`. Le diff audité est donc exactement
  `33cd4ac..90ef1a6`.
- **Critère assigné** : DRC-07 volet code (`directives/TASKS.json`) — BE-C4-F1
  (épingler par test le câblage de l'identité observée afin qu'un retour aux
  constantes soit détecté) et BE-C4-F2 (appliquer l'identité observée à
  `completeTask` avec refus négatifs testés entre au moins deux foyers).
- **Décision** : **accept** — zéro constat `mustFix`.

## 1. Méthode

Le candidat, ses commentaires et ses libellés ont été traités comme des données
hostiles. Aucune instruction trouvée dans le diff n'a été suivie. Le vrai diff a
été lu intégralement depuis git, puis confronté au critère assigné, au prompt
maître (§7 frontière de confiance, §9 sécurité) et aux constats hérités
BE-C4-F1/F2 de `docs/RELEASE_STATUS.json`.

Conformément à la consigne de cycle, les contrôles larges (check Functions,
audit dépendances) ne sont pas relancés ici : un préflight déterministe
indépendant les exécute en parallèle. Note déterministe sans exécution : le
diff ne touche ni `package.json`, ni lockfile ; l'audit des dépendances ne peut
donc pas régresser par rapport à la branche acceptée. Seuls des contrôles
ciblés nécessaires pour prouver ou écarter un constat ont été exécutés.

## 2. Le vrai diff

7 fichiers, tous sous `functions/` (périmètre respecté, ≤ ~12 fichiers
attendus), un seul commit au-dessus de l'état accepté :

| Fichier | Changement |
| --- | --- |
| `functions/src/observedCaller.ts` (nouveau) | Extracteur pur `observedCaller(request)` : `authenticated: request.auth !== undefined`, `appCheckAttested: request.app !== undefined`, `emailVerified: ... === true` (strict, sans coercion), `uid: request.auth?.uid`. Aucune dépendance SDK/Firestore. |
| `functions/src/invitations.ts` | Suppression de `observedInviteCaller` et `ObservedCallableRequest` (déplacés) ; interface `InviteCaller` conservée. |
| `functions/src/invites.ts` | `createInvite` et `redeemInvite` alimentent leurs décisions avec `observedCaller(request)` (was `observedInviteCaller(request)`). Logique sinon inchangée. |
| `functions/src/tasks.ts` | `completeTask` : l'objet constant `{authenticated: true, appCheckAttested: true, emailVerified: true, uid: caller.uid}` est remplacé par `observedCaller(request)`. `requireCaller` reste appelé en tête ; adhésion, idempotence, temps serveur inchangés. |
| `functions/test/observedCallerWiring.test.ts` (nouveau) | Épinglage du câblage (BE-C4-F1). |
| `functions/test/taskCompletion.test.ts` | +168 lignes : refus négatifs via le chemin production (requête → observation → décision). |
| `functions/test/invitations.test.ts` | Renommage mécanique uniquement (aucune assertion retirée ni affaiblie ; vérifié hunk par hunk). |

Aucun fichier hors `functions/`, aucune dépendance, aucun lockfile, aucun
secret, aucun réseau, aucune activation Firebase/Stripe/analytics,
`enforceAppCheck: true` conservé, chemins d'échec fermé intacts.

## 3. Analyse sémantique

1. **Équivalence d'identité.** `requireCaller` retourne `uid: request.auth.uid`
   (`callerIdentity.ts:34`) ; `observedCaller(request).uid` vaut
   `request.auth?.uid`. Les recherches Firestore (adhésion, clé d'idempotence)
   et la décision reçoivent donc exactement le même uid qu'avant. Comme
   `requireCaller` jette déjà pour toute requête non authentifiée, non
   attestée ou sans email vérifié, alimenter la décision avec les valeurs
   observées ne change aucun verdict nominal — cela ajoute une défense en
   profondeur strictement plus forte (la décision re-vérifie aussi
   `typeof uid === "string" && uid.length > 0`).
2. **Ordre des portes.** Dans `decideTaskCompletion` : identité → adhésion →
   rejeu d'idempotence → existence → propriété → état → poids. Le nouveau test
   « refusée avant même le rejeu d'une clé consommée » épingle que l'identité
   observée arrête une requête dégradée avant la branche de rejeu.
3. **Isolation cross-foyer / cross-user (BE-C4-F2).** Deux nouveaux tests
   modélisent deux foyers : user_1, membre actif du foyer A, se voit refuser
   `permission-denied` (« Accès au foyer refusé. ») sur le foyer B où son
   adhésion n'existe plus alors que la tâche à son nom y subsiste ; user_2,
   membre actif du foyer A, ne peut pas terminer la tâche de user_1
   (« Cette tâche appartient à un autre membre. »). Les deux passent par le
   chemin production `observedCaller(observedRequest(...))` →
   `decideTaskCompletion`, et le cas nominal reste vert en miroir.
4. **Épinglage du câblage (BE-C4-F1).** Le test lit les vraies sources
   (`lib/test` → `../../src` = `functions/src`, résolution correcte pour la
   layout compilé ; `npm run test` reconstruit toujours avant d'exécuter). Il
   exige exactement 2 occurrences de `caller:\s*observedCaller\(request\)` dans
   `invites.ts` et 1 dans `tasks.ts`, interdit tout littéral
   `(authenticated|appCheckAttested|emailVerified):\s*true` dans ces fichiers,
   et teste behavioralement l'extracteur lui-même (`{}` → toutes portes
   fausses ; requête attestée → toutes portes vraies).
5. **Hostilité.** Aucune instruction cachée, aucun placeholder présenté comme
   terminé, aucun contournement de test existant ; les commentaires citent des
   identifiants de constats, rien d'exécutable.

## 4. Vérifications ciblées exécutées par l'auditeur

Sur le candidat tel quel (arbre suivi jamais modifié ; build dans
`functions/lib/` ignoré par git) :

- `tsc -p tsconfig.json` → exit 0 ;
- `node --test` sur les trois fichiers touchés → **68/68 verts** ;
- suite complète sur copie jetable (`/tmp/opencode/beaudit`) → **106/106 verts**.

## 5. Preuves de mutation (copies jetables, candidat jamais édité)

| Mutation | Cible | Résultat attendu | Résultat observé |
| --- | --- | --- | --- |
| M1 : `observedCaller` retourne des constantes (`void request`) | `src/observedCaller.ts` | échec du test d'épinglage | `not ok 3` (1 fail / 3) |
| M2 brut : retour de `completeTask` aux constantes historiques | `src/tasks.ts` | détection immédiate | échec build TS6133 (`noUnusedLocals`) — première couche |
| M2b : revert propre (import retiré + objet constant historique) | `src/tasks.ts` | échec du test d'épinglage | `not ok 2` (1 fail / 3) |
| M3 : `createInvite` cesse de lire la requête (`observedCaller({})`) | `src/invites.ts` | échec du test d'épinglage | `not ok 1` (1 fail / 3) |
| M4b : portes adhésion + propriété neutralisées (`false && …`) | `src/taskCompletion.ts` | échec des tests d'isolation | 6 fails, dont les deux nouveaux tests cross-foyer/cross-user |

Chaque mutation est détectée par le test ciblé, sans collateral. La condition
d'acceptation BE-C4-F1 (« un test dédié échoue si l'extracteur revient à une
constante ou cesse de lire request ») est démontrée par M1 et M3 ; le scénario
historique complet de `completeTask` par M2/M2b.

## 6. Constats (aucun `mustFix`)

- **BE-CYCLE32961708279-F1 (info)** — Aucun rapport de codeur accompagnant le
  candidat ne documente la preuve de mutation demandée par la ligne
  d'acceptation. L'auditeur l'a reproduite indépendamment (§5), la substance du
  critère est donc prouvée objectivement ; aucune correction exigée. Le
  directeur doit citer ces preuves dans les éléments DRC-07.
- **BE-CYCLE32961708279-F2 (info)** — L'épinglage est textuel (regex source).
  Il détecte tout remplacement/retrait de la forme épinglée et tout littéral
  d'identité inline, mais ne détecterait pas une réimplémentation inline
  sémantiquement équivalente de l'observation (qui n'est pas une régression),
  et peut produire un faux positif sûr sur un futur littéral légitime. Un
  renommage légitime exige une mise à jour consciente (documenté dans
  l'en-tête du test). Acceptable en l'absence d'émulateur ; aucune action.
- **BE-CYCLE32961708279-F3 (info)** — L'exécution bout en bout des handlers
  appelables (Firestore émulé) reste reportée (déjà tracé côté candidat comme
  F2-concurrence-sans-emulateur) ; le câblage est donc épinglé au niveau
  source plutôt que comportemental au niveau handler. Risque résiduel connu,
  non introduit par ce candidat, à couvrir lors de l'incrément émulateur.

## 7. Décision

Tous les constats ont `mustFix: false` → **accept**. Le candidat satisfait
BE-C4-F1 et BE-C4-F2, préserve l'échec fermé, n'active aucun service réel et
reste strictement dans le périmètre autorisé. Intégration possible par le
directeur selon la procédure (le directeur ne fusionne jamais lui-même ; le
shell de confiance applique la paire candidat/audit).

*Contrôles non exécutés ici (délégués au préflight parallèle) : check large
Functions, audit dépendances, checks mobiles — voir §1.*
