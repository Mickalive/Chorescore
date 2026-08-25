# Prochain cycle accepté

## Jalon

`demo-rc` — application Android locale, persistante, honnête et révisable.

## État intégré au cycle 32857952394

- DRC-02 **complete** : la paire recovery réparée du run 32786797876
  (candidat `77b5c4e`, audit final round 2 `accept`, zéro `mustFix`) a été
  portée intégralement dans `lab/chorescore`. Persistance AsyncStorage
  versionnée, hydratation explicite sans clignotement, migration/corruption
  avec quarantaine, reprise déterministe du chronomètre, 102/102 tests.
- Le candidat courant `9d47082` (round 1 `accept`) n'a pas été intégré :
  doublon du même critère DRC-02, supersédé par la version réparée. Ses
  constats facultatifs sont répondus dans
  `reports/director/CYCLE_32857952394.md`.
- Aucun candidat backend ce cycle ; preuve legacy prose-only non intégrable.

## Critère actif

- **DRC-03 — Correction et contrôle des données**
- Mobile activé (tranche unique : modification/archivage, correction/
  suppression d'entrée, annulation de chrono, invariants du validateur).
- Backend désactivé : aucun travail serveur n'est nécessaire à cette tranche ;
  BE-C4-F1/F2 restent programmés sous DRC-07.
- Un audit indépendant mobile puis, si nécessaire, une correction par le même
  codeur et un second audit sont obligatoires.

## Ordre restant

1. DRC-03 correction/archivage/suppression/annulation ;
2. DRC-04 fonctions premium réellement locales ;
3. DRC-05 preuves de parcours et accessibilité (avec MOB-C4-F1/F2 obligatoires
   et MOB-C4-F3, MOB-CYCLE32857952394-F4, MOB-C5-N1 facultatifs) ;
4. DRC-07 PR/documentation/nettoyage de livraison (avec BE-C4-F1 obligatoire) ;
5. DRC-06 APK installable final via `pendingArtifact` et le shell de confiance.

Le directeur peut changer cet ordre seulement pour une régression prouvée, un
constat de sécurité obligatoire ou une dépendance réelle entre critères. Il
n'invente pas de travail backend lorsque le poste est désactivé.

## Constats conservés

Tous les constats ouverts vivent dans `docs/RELEASE_STATUS.json.openFindings`
(neuf à ce cycle). Ils ne sont pas perdus ; les obligatoires bloquent la
complétion de leur critère, les facultatifs sont repris quand leur critère
devient actif.
