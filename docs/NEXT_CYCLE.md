# Prochain cycle accepté

## Jalon

`demo-rc` — application Android locale, persistante, honnête et révisable.

## État intégré au cycle 32961708279

- Paires sélectionnées par le shell de confiance, validées par le directeur et
  déjà appliquées exactement dans `lab/chorescore` (base `33cd4ac` = HEAD
  vérifié) :
  - **mobile** : candidat réparé `e18bf1d` (round 2) + audit
    `reports/audits/CYCLE_32961708279_MOBILE_FINAL.json`, décision `accept`,
    zéro `mustFix` — 7 fichiers, +357/-26, strictement `app/`, `src/`,
    `tests/`. Le mustFix du tour 1 (inventaire de contraste incomplet) est
    résolu et prouvé ; MOB-C4-F1 (repli wrap du filtre membre) et MOB-C4-F2
    (frontières année/borne `now`) sont livrés ; suite complète 162/162 sur
    copie jetable.
  - **backend** : candidat `90ef1a6` (round 1, aucun repair demandé) + audit
    `reports/audits/CYCLE_32961708279_BACKEND.json`, décision `accept`, zéro
    `mustFix` — 7 fichiers `functions/`. Extracteur pur `observedCaller(request)`
    câblé dans les trois handlers, épinglage source avec mutations M1/M2b/M3
    reproduites par l'auditeur, `completeTask` sur identité observée avec refus
    négatifs cross-foyer/cross-user ; tsc OK, 68/68 fichiers touchés, 106/106
    copie jetable.
- **Non intégrés, consignés** : candidat mobile original + audit initial
  (supersédés par la paire réparée round 2) ; paires de récupération 32956994425
  mobile et backend (deux `accept` round 1 non sélectionnés — versions
  concurrentes supersédées) ; preuve legacy prose-only backend (insuffisante).
- **Nouveau constat bloquant établi sur l'arbre intégré** :
  `textSecondary` #457B9D sur `surfaceAlt` #F8F9FA = **4,36:1 < 4,5 AA**
  (libellés non sélectionnés du contrôle segmenté) et 4,43:1 sur la carte
  courante #F7FCFB. Issu du constat F2 de la paire de récupération non
  intégrée, vérifié par le directeur (lecture ciblée de `SegmentedControl.tsx`,
  `segmentedLayout.ts`, `theme.ts` + calcul WCAG selon la méthode de l'auditeur
  round 2, dont les mesures 4,5532/4,5921 sont reproduites à l'identique).
  L'audit round 2 intégré ne couvrait que l'inventaire `textMuted`.
  → DRC-05 reste `in_progress`.

## Critères actifs

- **DRC-05 — Qualité de parcours et accessibilité (dernier constat)** → mobile
  activé : contraste AA de `textSecondary` (jeton central ou jeton conforme,
  inventaire secondaire complet dans `tests/theme-contrast.test.ts`, mesure
  WCAG tracée, preuve de mutation). ~4 fichiers attendus.
- **DRC-07 — Livraison révisable (volet documentation)** → backend activé :
  actualiser `docs/security/README.md` (figé au cycle 32684730787) sur
  `observedCaller`, le câblage épinglé, `completeTask` à identité observée,
  contrôles remesurés et limites honnêtes. ~2 fichiers attendus.
- Périmètres disjoints (`app/`, `src/`, `tests/` vs `docs/security/**`) ;
  aucune slice : chaque mission tient très largement dans ~12 fichiers.
- Un audit indépendant par poste activé, puis correction par le même codeur et
  second audit si nécessaire, sont obligatoires.

## Ordre restant

1. DRC-05 : correction SEG puis complétion (preuves tests + audit exigées) ;
2. DRC-07 : volet documentation puis complétion (preuves documentation + audit
   exigées ; instructions racine vérifiées en lecture seule, PR brouillon
   unique maintenue par le shell, portes npm audit vertes) ;
3. DRC-06 APK installable final : quand tous les autres critères sont complets,
   définir `pendingArtifact: "DRC-06"`, vider `activeCriteria`, désactiver les
   deux codeurs, décider `stop` — le shell de confiance fige un commit source,
   construit, atteste et publie l'APK.

Le directeur peut changer cet ordre seulement pour une régression prouvée, un
constat de sécurité obligatoire ou une dépendance réelle entre critères.

## Contrôles manuels restants (explicitation DRC-05)

Conformément au résultat DRC-05 (« les contrôles manuels restants sont
explicités »), les contrôles suivants ne sont pas remplaçables par des preuves
déterministes et restent documentés comme résiduels de la démo :

- grandes tailles de texte système sur appareil réel : filtre membre en repli,
  navigation principale, modales de saisie/correction ;
- lecteur d'écran (TalkBack/VoiceOver) : parcours tâches → chronomètre →
  historique → export local ;
- partage système du fichier d'export local depuis l'appareil.

Ils seront repris tels quels dans l'état de livraison lors de la complétion
DRC-05 ; ils ne bloquent pas la boucle autonome mais restent des limites
consignées de la RC.

## Note humaine (subordonnée à la constitution)

La consigne « récupérer et intégrer le candidat DRC-02 corrigé du run
32786797876 » reste déjà satisfaite et tracée : le candidat réparé `77b5c4e` a
été intégré au cycle 32857952394 avec son audit round 2 `accept`
(`CYCLE_32786797876_MOBILE_FINAL.json`) et DRC-02 est `complete` avec ses deux
preuves. Aucune action de ce cycle n'y est consacrée : aucune paire de ce run
ne figure dans le manifeste d'intégration du cycle courant. La trajectoire
« poursuivre tous les critères restants jusqu'à l'APK standalone final
vérifié » est suivie : DRC-05 et DRC-07 au prochain cycle, puis DRC-06 via
`pendingArtifact`. Firebase, Stripe, analytics, secrets, déploiement et
données de production restent désactivés.

## Constats conservés

Tous les constats vivent dans `docs/RELEASE_STATUS.json.openFindings` :
MOB-C4-F1/F2 et BE-C4-F1/F2 passent à `resolved` (candidats intégrés, preuves
d'auditeur) ; le nouveau MOB-CYCLE32961708279-SEG devient la mission mobile ;
BE-CYCLE32961708279-F1 est résolu (preuves M1/M2b/M3 adoptées et citées),
F2/F3 notés pour l'incrément émulateur ; F3-R2 résolu (traçabilité), F2-R2 et
OPT-R2 reportés/notés ; les facultatifs plus anciens restent listés sous leur
critère. Ils ne sont pas perdus ; les obligatoires bloquent la complétion de
leur critère.
