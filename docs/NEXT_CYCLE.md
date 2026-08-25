# Prochain cycle accepté

## Jalon

`demo-rc` — application Android locale, persistante, honnête et révisable.

## État intégré au cycle 32864465631

- DRC-03 **complete** : la paire mobile round 1 (candidat `1fce8b3`, parent
  unique de l'état accepté `71c0d5d` ; audit
  `reports/audits/CYCLE_32864465631_MOBILE.json`, décision `accept`, zéro
  `mustFix`) a été portée bit-à-bit dans `lab/chorescore`. Modification et
  archivage de tâche, correction de durée recalculée depuis le `weightSnapshot`
  figé, suppression confirmée sans orpheline, annulation déterministe de
  chrono, validateur de persistance renforcé (intégrité référentielle +
  unicité), production en échec fermé sur les nouvelles opérations.
  121/121 tests application, export Android démo OK, audits prod exit 0,
  Functions 98/98.
- Aucun candidat backend ce cycle (HEAD du snapshot = base acceptée, aucun
  audit) ; la preuve legacy prose-only reste non intégrable.
- Aucune réparation demandée : l'audit round 1 est `accept`, les répertoires
  repaired/final sont vides et aucune seconde version n'existe à intégrer.

## Critère actif

- **DRC-04 — Fonctions premium honnêtes en démo**
- Mobile activé (tranche unique : filtres/synthèses semaine-mois, foyers
  locaux multiples isolés, export local réel, pondération démo figée par
  snapshot, paywall honnête).
- Backend désactivé : aucun travail serveur n'est nécessaire à cette tranche ;
  BE-C4-F1/F2 restent programmés sous DRC-07.
- Un audit indépendant mobile puis, si nécessaire, une correction par le même
  codeur et un second audit sont obligatoires.

## Ordre restant

1. DRC-04 fonctions premium réellement locales ;
2. DRC-05 preuves de parcours et accessibilité (avec MOB-C4-F1/F2 obligatoires
   et MOB-C4-F3, MOB-CYCLE32857952394-F4, MOB-C5-N1,
   MOB-CYCLE32864465631-F1 facultatifs) ;
3. DRC-07 PR/documentation/nettoyage de livraison (avec BE-C4-F1 obligatoire) ;
4. DRC-06 APK installable final via `pendingArtifact` et le shell de confiance.

Le directeur peut changer cet ordre seulement pour une régression prouvée, un
constat de sécurité obligatoire ou une dépendance réelle entre critères. Il
n'invente pas de travail backend lorsque le poste est désactivé.

## Constats conservés

Tous les constats vivent dans `docs/RELEASE_STATUS.json.openFindings` :
MOB-CYCLE32857952394-F1/F2 passent à `resolved` (validateur renforcé du
candidat intégré, preuve de mutation de l'auditeur) ; les trois constats info
du cycle courant sont répondus (`deferred`/`noted`) ; les autres restent
`unresolved` sous leur critère. Ils ne sont pas perdus ; les obligatoires
bloquent la complétion de leur critère, les facultatifs sont repris quand leur
critère devient actif.
