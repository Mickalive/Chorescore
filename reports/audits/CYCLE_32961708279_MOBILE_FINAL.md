# Audit final mobile — cycle 32961708279, tour 2 (candidat corrigé)

- **Rôle** : auditeur indépendant de livraison (`governance/roles/INDEPENDENT_RELEASE_AUDITOR.md`)
- **Candidat** : `/tmp/chorescore_mobile_repaired`, HEAD `e18bf1dabd08372203b152dc55a4098567e68261`
  (= `origin/cycle/chorescore/32961708279/mobile-repaired`)
- **Base de comparaison** : branche acceptée `lab/chorescore` à `33cd4ac`
  (checkout courant, intact)
- **Critère assigné** : DRC-05 « Qualité de parcours et accessibilité »
  (`directives/TASKS.json`, `governance/RELEASE_DEFINITION.json`)
- **Décision : `accept`** — l'unique constat `mustFix: true` du tour 1
  (MOB-CYCLE32961708279-F1) est démontrablement résolu ; le constat facultatif
  F3 est également traité ; F2 reste facultatif et non atteignable ; une
  observation résiduelle info est consignée ; aucun nouveau constat bloquant ;
  aucune régression sémantique détectée.

## 1. Identité et diff réel

Le candidat corrigé est le commit `e18bf1d` (« ChoreScore 32961708279: mobile
corrected candidate »), fils du candidat round 1 `89b1f5b`, lui-même fils de
l'état accepté `33cd4ac` (HEAD courant de `lab/chorescore`). Le diff réel :

- candidat complet vs base acceptée (`33cd4ac..e18bf1d`) : **7 fichiers,
  +357 / −26**, strictement dans `app/`, `src/`, `tests/`
  (`app/(tabs)/history.tsx`, `src/components/SegmentedControl.tsx`,
  `src/components/segmentedLayout.ts`, `src/components/theme.ts`,
  `tests/history.test.ts`, `tests/segmented-layout.test.ts`,
  `tests/theme-contrast.test.ts`) ;
- delta de correction (`origin/…/32961708279/mobile..mobile-repaired`) :
  **exactement 2 fichiers** — `tests/theme-contrast.test.ts` (paire + docblock)
  et `src/components/theme.ts` (commentaire uniquement, jeton `#56707C`
  inchangé).

Worktree candidat propre vis-à-vis de son HEAD (seul `node_modules` non suivi),
vérifié avant et après tous les contrôles. Manifeste immuable
(`sha256sum -c .github/immutable-files.sha256`) : OK sur le candidat. Aucune
dépendance, aucun lockfile, aucun réseau, aucun fichier hors périmètre.

## 2. Vérification du requiredFix obligatoire (tour 1)

### MOB-CYCLE32961708279-F1 — paire #FFFDF5 absente de l'inventaire → RÉSOLU

- **Correction exigée** : ajouter
  `['#FFFDF5', 'carte Pro du paywall (proCard — perMonth)']` au tableau
  `mutedBackgrounds` et corriger le docblock. **Appliquée à l'identique**, avec
  la note « bienvenue » demandée : le docblock et le commentaire de
  `theme.ts` signalent `#FFFDF5` comme fond codé en dur hors jetons, candidat à
  une future tokenisation.
- **Inventaire indépendant de l'auditeur** : les 15 usages de style de
  `COLORS.textMuted` dans `app/` et `src/` retombent exclusivement sur cinq
  fonds — background `#FEFEFE` (aides des trois modales, `PaywallModal.current`,
  pied d'onboarding, disclaimer classement), surface `#FFFFFF` (cartes :
  `entryMeta`/`entryMinutes`, `memberMeta` hors carte courante,
  `MetricCard.detail`, `NativeBarChart.value`, barre d'onglets, carte Standard
  pour le premier `perMonth`), `surfaceAlt` `#F8F9FA` (`retentionText`),
  `#F7FCFB` (`currentCard`) et `#FFFDF5` (`proCard`, override de `planCard`,
  second `perMonth`). Les cinq paires du test sont donc exhaustives.
- **Recalcul WCAG indépendant** (implémentation propre, seuil linéaire
  0,04045) : `#56707C` sur les cinq fonds = **5,20 / 5,24 / 4,98 / 5,06 /
  5,15:1**, tous ≥ 4,5 (AA) ; ancien `#6D8793` = 3,60–3,79:1, justifiant le
  garde de régression.
- **Vérification demandée, exécutée** sur copie jetable (candidat jamais
  édité) : `node scripts/clean-test-build.mjs && npx --no-install tsc -p
  tsconfig.test.json` OK ; `node --test .test-build/tests/theme-contrast.test.js
  .test-build/tests/segmented-layout.test.js .test-build/tests/history.test.js`
  → **15/15 verts**, nouvelle paire incluse.
- **Preuves de mutation** (copies jetables) :
  - *A* — jeton ramené à `#6D8793` → theme-contrast **2 pass / 1 fail**
    (message citant la paire `#FEFEFE`, 3,76:1 < 4,5:1) : le garde détecte une
    régression ;
  - *B* — retrait de la seule ligne `#FFFDF5` → **3/3 verts** : la paire
    ajoutée est l'unique delta de couverture de la correction.

## 3. Constats facultatifs

- **F3 (traçabilité theme.ts) — appliqué** : le commentaire ne référence plus
  « MOB-C4-F3 » mais « DRC-05 (passe contraste textMuted,
  directives/TASKS.json) » ; grep négatif sur tout le diff ;
  `docs/RELEASE_STATUS.json` non touché par le candidat (MOB-C4-F3 reste
  `unresolved`, à la charge du directeur).
- **F2 (maxWidth du mode wrap) — non appliqué, toujours non atteignable** :
  les libellés du filtre membre restent des identités de démonstration fixes,
  sans action de création ni renommage dans `appReducer.ts`. Le fichier
  `segmentedLayout.ts` et son test sont identiques entre les deux tours :
  aucune régression. Reste une amélioration conditionnelle à une future
  évolution rendant les noms saisissables.

## 4. Observation résiduelle (info, non bloquante)

**OPT-R2 — dérive statique possible d'un fond codé en dur** : le fond
`#FFFDF5` de `proCard` vit hors jetons et le test épingle ce littéral. Preuve
par mutation *C* sur copie jetable : `proCard` → `#E3DCC0` (paire recalculée
3,81:1, non conforme) laisse le test à 3/3 verts. Risque déjà caractérisé au
tour 1, dont le requiredFix exigeait précisément l'ajout de la paire au tableau.
Aucune violation aujourd'hui (toutes les paires réelles ≥ 4,5:1) ; remédiation
future : tokeniser le fond de la carte pour que le garde du thème la protège.

## 5. Régressions sémantiques : rien trouvé

- Mode défaut du `SegmentedControl` **valeur-pour-valeur identique** aux styles
  supprimés (conteneur row/padding 4/pill/surfaceAlt/bordure/gap 4 ; option
  flex 1/minHeight 42/centrage/pill) ; `wrap` utilisé par le seul filtre membre
  de l'historique — période, classement et profil inchangés.
- Réinitialisation F3-R2 du filtre membre intacte ; `reportFile` toujours
  `textSecondary` (commentaire mis à jour honnêtement) ; aucun fichier
  domaine/store touché.
- Test MOB-C4-F2 : ancre non circulaire vérifiée indépendamment
  (`startOfWeek` lundi-based : now vendredi 01/01/2027 12:00 → semaine annoncée
  au lundi 28/12/2026, mois au 01/01/2027 00:00 ; bornes inclusives start/now
  testées à ±1 s).
- Suite unitaire complète sur copie jetable : **162/162 verts** ; seuls les deux
  nouveaux fichiers de test référencent thème/segments, le changement de jeton
  ne peut casser aucune autre assertion de couleur.
- Hostilité : scan du diff négatif (aucune instruction cachée, réseau, secret,
  dépendance, assertion retirée).

## 6. Checks exécutés et non exécutés

Exécutés : identité git, diff réel + delta de réparation, manifeste immuable,
inventaire textMuted, recalcul WCAG indépendant, tests ciblés exigés par F1
(15/15), mutations A/B/C, suite unitaire complète (162/162), revue sémantique,
scan d'hostilité.

Non exécutés, motivés : `npm run check` complet, export Expo Android démo et
`npm audit` — duplication avec la porte de vérification déterministe finale du
workflow de confiance ; aucun constat du présent audit ne les exigeait.

## 7. Décision

**`accept`** — tous les constats du présent rapport ont `mustFix: false`.
Le candidat corrigé `e18bf1d` satisfait les trois lignes d'acceptation DRC-05
qui lui étaient assignées (MOB-C4-F1 avec contrat de mise en page testé,
MOB-C4-F2 avec frontière d'année et borne `now` non circulaires, contraste
`textMuted` central ≥ 4,5:1 mesuré et gardé déterministe sur chaque fond réel),
sans régression des invariants DRC-02/DRC-03/DRC-04 ni élargissement de
périmètre.
