# Audit final mobile — cycle 32919230502, tour 2 (candidat corrigé)

- **Rôle** : auditeur indépendant de livraison (`governance/roles/INDEPENDENT_RELEASE_AUDITOR.md`)
- **Candidat** : `/tmp/chorescore_mobile_repaired`, HEAD `327fba8d7b64c01e67f673c4bceac829144c5d00`
  (= `origin/cycle/chorescore/32919230502/mobile-repaired`)
- **Base de comparaison** : branche acceptée `lab/chorescore` à `04636836523ba35d2b15cd9b369a9055a46aaecd`
  (checkout courant, intact)
- **Critère assigné** : DRC-04 « Fonctions premium honnêtes en démo » (`directives/TASKS.json`,
  `governance/RELEASE_DEFINITION.json`)
- **Décision : `accept`** — l'unique constat `mustFix: true` du tour 1
  (MOB-CYCLE32919230502-F1) est démontrablement résolu ; les cinq constats
  facultatifs sont également traités ; aucun nouveau constat bloquant ; aucune
  régression sémantique détectée dans le diff de correction.

## 1. Identité et diff réel

Le candidat corrigé est le commit `327fba8` (« ChoreScore 32919230502: mobile
corrected candidate »), fils du candidat round 1 `e1983a7`, lui-même fils de
l'état accepté `0463683` (HEAD courant de `lab/chorescore`). Le diff réel :

- candidat complet vs base acceptée (`0463683..327fba8`) : **11 fichiers,
  +1787 / −68**, strictement dans `app/`, `src/`, `tests/` ;
- delta de correction (`e1983a7..327fba8`) : **7 fichiers, +186 / −21** —
  exactement les fichiers visés par les constats F1 à F6.

Worktree candidat propre vis-à-vis de son HEAD (seul `node_modules` non suivi),
vérifié avant et après tous les contrôles. Aucune atteinte aux fichiers
immuables (manifeste `sha256sum -c .github/immutable-files.sha256` : OK sur le
candidat), aux dépendances, lockfiles, workflows ou backend.

## 2. Vérification du requiredFix obligatoire (tour 1)

### MOB-CYCLE32919230502-F1 — migration v1→v2 sans re-validation → RÉSOLU

- **Correction exigée** : rejouer `isDurableState` sur l'état migré dans
  `parseEnvelope` et retourner `{outcome:'invalid', reason:'invalid-shape'}` en
  cas d'échec. **Implémentée à l'identique** dans `src/store/persistence.ts`
  (branche `version === 1` : garde `if (!isDurableState(migrated))` avec
  commentaire expliquant pourquoi le validateur v2 est strictement plus
  exigeant que le v1).
- **Cas de test exigés** — tous présents dans `tests/persistence.test.ts` :
  1. document v1 valide avec une entrée vers un foyer inconnu → `invalid` ;
  2. adhésion vers un utilisateur inconnu et adhésion vers un foyer inconnu →
     `invalid` (un même test couvre les deux sous-cas, forme v1 restant valide
     dans les deux) ;
  3. utilisateur actif sans adhésion au foyer actif → `invalid` ;
  4. non-régression : tout état issu de `migrateV1ToV2` sur un document v1
     cohérent satisfait `isDurableState` et reste `valid` avec
     `migratedFrom: 1`.
  Un cinquième test, au-delà de l'exigé, prouve la quarantaine visible dès la
  première lecture (`loadDurableState` → `recovered/quarantined`, clé principale
  vidée, charge brute intacte sous `QUARANTINE_KEY`).
- **Vérification demandée, exécutée** : `npx tsc -p tsconfig.test.json` OK ;
  `node --test .test-build/tests/persistence.test.js
  .test-build/tests/premium-local.test.js .test-build/tests/data-control.test.js`
  → **76/76 verts** (70 du tour 1 + 6 nouveaux).
- **Reproduction indépendante** (script jetable `/tmp/opencode/reprove-f1-final.mjs`
  sur le build compilé du candidat) : un v1-valide avec
  `entry.householdId='household_ghost'` donne désormais
  `parseEnvelope(raw).outcome === 'invalid'` (au lieu de `'valid'` au tour 1) ;
  les deux autres incohérences aussi ; le v1 cohérent migre toujours en
  `valid`. Sortie : `REPRODUCTION_OK`.
- **Preuve de mutation** (copie jetable `/tmp/opencode/mutation_f1`, supprimée
  après contrôle, candidat jamais édité) : retrait de la seule garde
  `isDurableState(migrated)` puis recompilation → exactement les **4 nouveaux
  tests F1 échouent** (31 tests : 27 pass / 4 fail). Les tests gardent
  réellement la correction.

## 3. Constats facultatifs du tour 1 — tous traités

| Constat | Traitement | Preuve |
| --- | --- | --- |
| F2 (low) chrono invisible après bascule | `SWITCH_HOUSEHOLD` annonce le chrono trans-foyer en nommant le foyer d'origine ; condition identique au garde « un seul chrono » de `planStartTimer` (même personne, `in_progress`), filtrée sur l'autre foyer | test dédié « basculer de foyer alors qu'un chrono tourne annonce le foyer où l'arrêter » : notice exacte + refus persistants de `completeTimer`/`cancelTimer` depuis l'autre foyer |
| F3 (info) filtre membre orphelin | `useEffect` réinitialisant `memberFilter` à `null` sur changement de `state.currentHouseholdId` | diff `app/(tabs)/history.tsx` ; retour au segment « Foyer » à chaque bascule |
| F4 (info) constante morte | `MONTHS_FR` supprimée de `exportReport.ts` | `grep -rn MONTHS_FR src/` ne montre plus que `history.ts` (déclaration + usage) ; typecheck vert |
| F5 (info) ordinal français | `formatDateFr` émet « 1er » quand `getDate()===1` | assertions mises à jour et vertes : « Mois du 1er août 2026… » et « Mois du 1er janvier 2027 » |
| F6 (info) contraste méta-ligne rapport | `reportFile` passe de `textMuted` à `textSecondary` | calcul WCAG indépendant sur `theme.ts` : #457B9D sur #FEFEFE = **4,55:1** (≥ 4,5 AA) contre 3,76:1 pour l'ancien #6D8793 |

## 4. Recherche de régressions sémantiques (delta de correction)

- `persistence.ts` : la garde ne touche que la branche `version === 1` ; le
  chemin v1 cohérent est prouvé inchangé (cas 4 de la reproduction :
  `valid`, `migratedFrom: 1`, état migré identique). Les documents v2 et les
  versions inconnues suivent des branches non modifiées.
- `appReducer.ts` : sans chrono trans-foyer, la notice de bascule reste
  exactement `Foyer actif : ….` (testé explicitement) ; avec un chrono, une
  personne ne peut avoir qu'un seul `in_progress` global (garde
  `planStartTimer`), donc la recherche `find` est exhaustive. Aucune action
  cross-foyer n'est devenue possible : les six planners gardent leur refus
  « autre foyer » (tests dédiés verts).
- `history.tsx` : le `useEffect` ne fait qu'écrire `null` dans un état local
  d'écran ; aucune incidence données ni annonces.
- `exportReport.ts` / `history.ts` : suppressions et libellés uniquement ;
  `describePeriodBounds` reste construit sur `getPeriodStart` (bornes =
  filtrage, testé).
- Tests : aucune assertion affaiblie ; la seule suppression est le test
  obsolète `SCHEMA_VERSION === 1`, remplacé par son équivalent v2
  (`SCHEMA_VERSION === 2`). Non-régression ciblée supplémentaire :
  `node --test .test-build/tests/store-interactions.test.js` → **18/18**
  (couvre notamment `RESET_DEMO` sous la nouvelle sémantique de roster).
- Hostilité : scan du diff complet (instructions injectées, réseau, `eval`,
  secrets, motifs d'affaiblissement) négatif ; périmètre strictement
  `app/`, `src/`, `tests/`.

## 5. Checks exécutés

Voir la liste complète dans `CYCLE_32919230502_MOBILE_FINAL.json`. Les
vérifications larges (`npm run check` complet, export Expo, `npm audit`) ne
sont pas relancées : duplication avec la porte de vérification déterministe
finale du workflow de confiance, et aucun constat ne les exigeait ; les checks
ciblés demandés par le `requiredFix` de F1 ont été exécutés intégralement.

## 6. Décision

**`accept`** — tous les constats du présent rapport ont `mustFix: false`.
Le candidat corrigé `327fba8` satisfait le critère DRC-04 dans les limites
déjà consignées au tour 1 (gravité medium, inaccessible par les flux normaux
de l'app, désormais fermée dès la première lecture). Aucune correction
obligatoire ; le directeur peut intégrer cette paire candidat/audit.
