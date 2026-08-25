# Audit final mobile — cycle 32786797876, tour 2 (candidat corrigé)

- **Rôle** : auditeur indépendant de livraison (`governance/roles/INDEPENDENT_RELEASE_AUDITOR.md`)
- **Candidat** : `/tmp/chorescore_mobile_repaired`, HEAD `77b5c4e05ffd0553359c934f21164ca6707232c4`
  (= `origin/cycle/chorescore/32786797876/mobile-repaired`)
- **Base de comparaison** : branche acceptée `lab/chorescore` à `b3d9eb6a2585aafaff7598d30291b923c6d0c489`
  (checkout courant, intact)
- **Critère assigné** : DRC-02 « Persistance et reprise » (`directives/TASKS.json`,
  `governance/RELEASE_DEFINITION.json`)
- **Décision : `accept`** — les quatre constats `mustFix: true` du tour 1 sont
  démontrablement résolus ; aucun nouveau constat bloquant.

## 1. Identité et diff réel

Le candidat corrigé descend du snapshot vide du tour 1 : parent de `77b5c4e` =
`83e8e3d`, dont l'arbre (`caaaa40e…`) est octet pour octet celui de l'état
accepté `b3d9eb6`. Le diff réel de correction est donc exactement :

```
12 fichiers modifiés, +1261 / −24
M  app/(tabs)/history.tsx          M  src/store/AppProvider.tsx
M  app/(tabs)/profile.tsx          M  src/store/appReducer.ts
M  app/_layout.tsx                 A  src/store/persistence.ts
M  app/onboarding.tsx              A  tests/persistence.test.ts
A  src/components/HydrationGate.tsx
A  src/domain/timerRules.ts
M  src/services/demoService.ts
A  src/services/storage.ts
```

Worktree candidat propre vis-à-vis de son HEAD (seul `node_modules` non suivi).
Périmètre strictement mobile (`app/`, `src/`, `tests/`) : aucune atteinte aux
fichiers immuables, dépendances, lockfiles ou backend.

## 2. Vérification des requiredFix du tour 1

### MOB-C5-F1 — persistance versionnée et hydratation explicite → RÉSOLU

- `src/store/persistence.ts` : clé dédiée `chorescore.demo.state.v1`,
  enveloppe `schemaVersion: 1`, sérialisation stable (clés triées,
  `serializeStable`), écritures sérialisées (`createSequentialWriter`),
  garde-fou de taille 512 Ko.
- `src/services/storage.ts` : adaptateur AsyncStorage isolé. La dépendance
  `@react-native-async-storage/async-storage@2.2.0` était **déjà déclarée**
  dans le `package.json` accepté — aucune nouvelle dépendance.
- `AppProvider.tsx` : hydratation à trois phases (`loading` → `ready` /
  `error`) ; état de chargement volontairement vide (`createLoadingState`,
  testé sans aucune donnée `demoData`) ; sauvegarde de la tranche durable après
  chaque mutation métier via effet sur les champs persistés.
- `app/_layout.tsx` : aucune route ne se rend tant que l'hydratation n'est pas
  prête (`HydrationBoundary` + `HydrationGate`) — aucun clignotement possible ;
  écran d'erreur avec reprise explicite et annonces accessibles.

### MOB-C5-F2 — migration et corruption sans perte silencieuse → RÉSOLU

- Désérialisation encadrée (`parseEnvelope`), validation structurelle profonde
  contre le schéma v1 (`isDurableState` : utilisateurs, foyer, adhésions,
  tâches, entrées, consentement), refus propre des versions inconnues (> 1) et
  des charges inférieures ou mal formées.
- Récupération explicite : la charge illisible est mise en quarantaine
  (`chorescore.demo.state.quarantine`) **avant** suppression de la clé
  principale ; tout échec de quarantaine laisse la donnée brute en place —
  aucune perte silencieuse dans les deux cas.
- Réinitialisation informée : un avis visible décrit la cause et le sort de la
  charge (`describeRecovery`).

### MOB-C5-F3 — reprise déterministe du chronomètre → RÉSOLU

- `src/domain/timerRules.ts` : règle documentée et déterministe, horloge
  injectée (`applyRestartRules(snapshot, now)`) — reprise depuis le
  `startedAt` conservé sous 24 h ; expiration à ≥ 24 h avec durée plafonnée,
  score recalculé et `completedAt = départ + 24 h` ; entrée impossible
  (`startedAt` absent/illisible) clôturée à durée nulle, jamais perdue.
- Avis visible à la reprise (`describeRestartEvents`).
- `demoService.completeTimer` refactoré sur `getCappedDurationSeconds` :
  sémantique identique à l'ancien calcul inline (plancher 1 s, plafond 24 h) —
  aucune régression, confirmée par les 79 tests préexistants verts.

### MOB-C5-F4 — batterie de tests → RÉSOLU

- `tests/persistence.test.ts` : 23 nouveaux tests couvrant premier lancement,
  restauration exacte depuis un stockage semé, migration undefined→v1,
  sérialisation stable, sauvegarde après mutation, écritures concurrentes
  sérialisées (dernière gagne), corruption (JSON invalide, v99, v0, forme
  invalide, statut/date interdits), surcharge lecture/écriture, échec
  d'écriture, stockage indisponible, reprise/expiration/réparation du chrono
  avec bornes exactes (24 h pile expire, 24 h − 1 s reprend) et horloge
  injectée.
- Total : 79 → **102 tests, tous verts**.
- **Preuve de sensibilité** : injection de faute sur une copie isolée
  (`/tmp/opencode/fault-inject`, candidat intact) — désactiver la validation de
  forme et la règle d'expiration fait échouer exactement les 5 tests ciblés
  (97 pass / 5 fail). La suite détecte bien une régression de la logique de
  stockage. Copie supprimée après vérification.

## 3. Audit de régression du diff complet

- Périmètre : uniquement `app/`, `src/`, `tests/`. Ni `governance/**`, ni
  `directives/**`, ni workflows, ni dépendances, ni lockfiles, ni `functions/`.
- Aucun appel réseau ajouté ; la démo reste hors ligne (scan des nouveaux
  fichiers : aucun `fetch`/WebSocket/XHR).
- Scan d'hostilité du diff : aucun motif d'instruction injectée ; les seules
  correspondances étaient des faux positifs (`overrides`, paramètre de test).
- Honnêteté améliorée : les textes d'onboarding, profil et historique annoncent
  désormais la conservation locale réelle (« restent sur cet appareil ») au
  lieu de l'ancienne phrase « rien n'est conservé » — cohérent avec la
  persistance effective, conforme au canon (données synthétiques locales,
  zéro réseau).
- Comportements préexistants préservés : actions du reducer additives,
  planificateurs `planX` extraits sans changement sémantique, 79 tests
  préexistants verts.

## 4. Checks réellement exécutés

1. Identité : `rev-parse` workspace = `77b5c4e` = `origin/…/mobile-repaired` ;
   parent = `83e8e3d` ; arbres de `83e8e3d` et `b3d9eb6` identiques
   (`caaaa40e…`) ; worktree propre (hors `node_modules` non suivi).
2. Diff réel `git diff b3d9eb6 77b5c4e` (`--stat`, `--name-status`, `--raw`) :
   12 fichiers, +1261/−24, tous dans le périmètre mobile.
3. Dépendances : `package.json`, `package-lock.json`, `functions/` hors diff ;
   `async-storage@2.2.0` déjà déclarée dans la base acceptée.
4. Scan hostilité et réseau du diff : négatif.
5. `npm ci --ignore-scripts` puis `npm run check` : typecheck OK, **102/102
   tests** verts (79 préexistants + 23 nouveaux).
6. Injection de faute sur copie isolée : 5 tests échouent quand la logique de
   stockage est cassée — sensibilité de la suite prouvée ; copie supprimée.
7. `npm audit --omit=dev --audit-level=high` : code sortie 0, 11 vulnérabilités
   modérées, aucune haute/critique (identique à la base acceptée).
8. Manifeste immuable `sha256sum -c .github/immutable-files.sha256` : 0 échec.
9. Export Android démo `EXPO_PUBLIC_DATA_MODE=demo npx --no-install expo
   export --platform android` : succès (bundle produit) — exécuté car
   `app/_layout.tsx` change ; `dist/` nettoyé ensuite, worktree rendu intact.

## 5. Observations non bloquantes

- **MOB-C5-N1** : la sauvegarde se déclenche aussi juste après
  `HYDRATION_READY`, réécrivant l'état restauré à chaque démarrage. Écriture
  redondante inoffensive (une par lancement) ; optimisation facultative.
- **MOB-C5-F5 (tour 1, info)** : l'anomalie de processus est close côté
  produit — le snapshot corrigé est non vide et livre la tranche DRC-02. Le
  suivi de l'incident (signal d'échec explicite d'une étape runner) reste une
  affaire de directeur.
- Les constats hérités DRC-05 (`MOB-C4-F1/F2`) ne sont pas rejoués ici : leur
  critère n'est pas actif (`docs/NEXT_CYCLE.md`). Ils demeurent suivis dans
  `docs/RELEASE_STATUS.json.openFindings`.

## 6. Décision

**`accept`** — tous les constats du présent rapport ont `mustFix: false`.
Les cinq critères d'acceptation DRC-02 sont satisfaits avec preuves exécutées.
Le directeur peut intégrer ce candidat dans `lab/chorescore`.
