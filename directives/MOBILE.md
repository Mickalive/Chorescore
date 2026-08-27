# Tâche active — Ingénieur produit mobile

Assignment-Id: DRC-06
Autorité de poste : `governance/roles/MOBILE_PRODUCT_ENGINEER.md`
Sélecteur machine : `directives/TASKS.json`

## Statut

DRC-05 est `complete` (cycle 33111799778 : audit verification-only accepté,
textSecondary #3C6E8E ≥ 4,5:1 sur les 8 fonds réels, 164/164 tests, mutation
prouvée). DRC-06 est le dernier critère.

## Résultat attendu

Tâche bornée **DRC-06 source-readiness** : vérifier que l'état accepté
(SHA 37b6d05) est apte au build APK release. Cette tâche est une
pré-vérification auditable — elle ne construit pas l'APK.

## Travail borné

1. **Revue de code** — inspecter `app/` et `src/` pour tout placeholder,
   `// TODO`, `console.log` de debug, code conditionnel node-only ou
   instruction cachée. Tout point trouvé doit être documenté dans le rapport.

2. **Exports/config Android** — vérifier `app.json`, `eas.json` ou
   équivalent : cohérence avec la démo hors ligne (`EXPO_PUBLIC_DATA_MODE=demo`),
   pas de référence à des services réels (Firebase project ID, Stripe key,
   analytics endpoint).

3. **Démo hors ligne** — s'assurer qu'aucun import conditionnel ne pointe vers
   des services réels dans le code produit ; aucun appel réseau au runtime en
   mode demo ; la démo fonctionne sans Metro.

4. **Tests existants** — `npm run check` doit rester vert (164+ tests).

5. **Documentation** — si un point bloquant résiduel est trouvé, le documenter
   clairement dans le rapport du codeur avec sa sévérité et son impact sur le
   build APK.

## Hors périmètre

Ne pas construire l'APK. Ne pas modifier de dépendance, lockfile, workflow,
agent ou gouvernance. Ne pas activer de service réel. Ne pas toucher au code
produit au-delà de la correction d'un point bloquant documenté (si nécessaire,
uniquement avec audit préalable).

## Preuves attendues

Rapport du codeur documentant la vérification de chaque point (code, config,
hors ligne, tests) avec statut OK ou finding documenté. Puis audit
indépendant avec décision `accept`, 0 `mustFix`.
