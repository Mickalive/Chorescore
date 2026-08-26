# Prochain cycle accepté

## Jalon

`demo-rc` — application Android locale, persistante, honnête et révisable.

## État intégré au cycle 32919230502

- DRC-04 **complete** : la paire mobile réparée round 2 (candidat `327fba8`,
  parent `e1983a7`, base `0463683` = HEAD accepté ; audit
  `reports/audits/CYCLE_32919230502_MOBILE_FINAL.json`, décision `accept`,
  zéro `mustFix`) a été appliquée exactement par le shell de confiance dans
  `lab/chorescore` (11 fichiers, +1787/-68, strictement `app/`, `src/`,
  `tests/`). Filtres et synthèses semaine/mois réels, foyers locaux multiples
  isolés dans le document persisté v2, export local réellement consultable,
  pondération figée par `weightSnapshot`, paywall honnête. Le mustFix F1 du
  tour 1 (migration v1→v2 sans re-validation) est résolu et prouvé ;
  les cinq améliorations facultatives F2–F6 sont appliquées.
- Preuves tests DRC-04 : vérifications ciblées de l'auditeur round 2 sur le
  contenu intégré (tsc OK, 76/76 persistence+premium-local+data-control,
  18/18 store-interactions, preuves de mutation). Les checks déterministes
  larges et l'export Android tournent en parallèle sur l'arbre audité gelé :
  en cas d'échec le workflow échoue fermé et renvoie la cause prouvée à un
  cycle ultérieur, sans retouche du produit par le directeur.
- Backend : aucun candidat (répertoires absents) — rien intégré côté backend ;
  la preuve legacy prose-only reste rejetée.
- Paire de récupération 32915047376 (candidat `aecbb48`, audit round 1
  `accept`) **non intégrée** : version concurrente du même critère DRC-04,
  supersédée par le candidat réparé conformément à la règle de supersession ;
  ses deux constats info (mémoisation du libellé de période, forme de
  `CreateHouseholdResult`) sont des pistes à revérifier sur le code intégré,
  pas des défauts établis.

## Critères actifs

- **DRC-05 — Qualité de parcours et accessibilité** → mobile activé
  (mission unique bornée : MOB-C4-F1, MOB-C4-F2, contraste `textMuted`
  central ≥ 4,5:1 mesuré ; facultatifs MOB-C5-N1, garde d'hydratation,
  mémoisation).
- **DRC-07 — Livraison révisable (volet code)** → backend activé
  (mission unique bornée : BE-C4-F1 épinglage `observedInviteCaller` par test
  avec preuve de mutation, BE-C4-F2 identité observée dans `completeTask` avec
  refus négatifs).
- Périmètres disjoints (`app/`, `src/`, `tests/` vs `functions/`) ; aucune
  slice nécessaire : chaque mission tient dans ~12 fichiers.
- Un audit indépendant par poste activé, puis correction par le même codeur et
  second audit si nécessaire, sont obligatoires.

## Ordre restant

1. DRC-05 preuves de parcours et accessibilité (mobile) ;
2. DRC-07 volet code backend + consolidation documentation/PR lorsque les
   constats code sont levés ;
3. DRC-06 APK installable final via `pendingArtifact` et le shell de confiance,
   une fois tous les autres critères complets et l'audit DRC-06 accepté.

Le directeur peut changer cet ordre seulement pour une régression prouvée, un
constat de sécurité obligatoire ou une dépendance réelle entre critères.

## Contrôles manuels restants (consolidation DRC-05)

À compléter par le directeur à réception du rapport mobile : parcours restant
à validation manuelle (grandes tailles de texte sur appareil réel, lecteur
d'écran, partage système de l'export local). Ces contrôles seront explicités
ici et dans l'état de livraison avant de déclarer DRC-05 complet.

## Note humaine (subordonnée à la constitution)

La consigne « récupérer et intégrer le candidat DRC-02 corrigé du run
32786797876 » est déjà satisfaite et tracée : le candidat réparé `77b5c4e` a
été intégré au cycle 32857952394 avec son audit round 2 `accept`
(`CYCLE_32786797876_MOBILE_FINAL.json`), et DRC-02 est `complete` avec ses deux
preuves. Rien à refaire. La trajectoire « poursuivre tous les critères
restants jusqu'à l'APK standalone final vérifié » est suivie : DRC-05 et
DRC-07 ce cycle, puis DRC-06 via `pendingArtifact`. Firebase, Stripe,
analytics, secrets, déploiement et données de production restent désactivés.

## Constats conservés

Tous les constats vivent dans `docs/RELEASE_STATUS.json.openFindings` :
MOB-CYCLE32919230502-F1 et -OPT passent à `resolved` (candidat réparé intégré,
preuves de l'auditeur round 2) ; MOB-C4-F1/F2 deviennent la mission mobile du
cycle ; BE-C4-F1/F2 la mission backend ; les facultatifs restent listés sous
leur critère et sont repris quand il est actif. Ils ne sont pas perdus ; les
obligatoires bloquent la complétion de leur critère.
