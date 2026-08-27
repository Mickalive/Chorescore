# Prochain cycle accepté

## Jalon

`demo-rc` — application Android locale, persistante, honnête et révisable.

## État intégré au cycle 33086880966

- **Delta backend intégré et accepté** : `docs/security/README.md` actualisé (+4/-2, 1 fichier) — numéro de cycle 33086880966, clarification que le décompte de tests a été rejoué intégralement. Audit `RUN_33086880966_BACKEND.json` : décision `accept`, 0 `mustFix`, toutes les affirmations vérifiées indépendamment.
- **SHA courant** : `37b6d05` (inclus le delta backend).
- **Mobile sans candidat** ce cycle (audit-unavailable). Le delta mobile du cycle 32961708279 (candidat réparé `e18bf1d`, 7 fichiers app/src/tests) reste l'état accepté.
- **DRC-07 passe à `complete`** — volet code (cycle 32961708279) + volet documentation (cycle 33086880966) tous deux acceptés.
- **Constat bloquant persistant** : `textSecondary` #457B9D sur `surfaceAlt` #F8F9FA = **4,36:1 < 4,5 AA** (libellés non sélectionnés du contrôle segmenté) et 4,43:1 sur la carte courante #F7FCFB. → DRC-05 reste `in_progress`.

## Critères actifs

- **DRC-05 — Qualité de parcours et accessibilité (dernier constat)** → mobile activé : contraste AA de `textSecondary` (jeton central ou jeton conforme, inventaire secondaire complet dans `tests/theme-contrast.test.ts`, mesure WCAG tracée, preuve de mutation). ~4 fichiers attendus.

## Ordre restant

1. DRC-05 : correction SEG puis complétion (preuves tests + audit exigées) ;
2. DRC-06 APK installable final : quand DRC-05 est complete, définir `pendingArtifact: "DRC-06"`, vider `activeCriteria`, désactiver les deux codeurs, décider `stop` — le shell de confiance fige un commit source, construit, atteste et publie l'APK.

Le directeur peut changer cet ordre seulement pour une régression prouvée, un constat de sécurité obligatoire ou une dépendance réelle entre critères.

## Contrôles manuels restants (explicitation DRC-05)

Conformément au résultat DRC-05 (« les contrôles manuels restants sont explicités »), les contrôles suivants ne sont pas remplaçables par des preuves déterministes et restent documentés comme résiduels de la démo :

- grandes tailles de texte système sur appareil réel : filtre membre en repli, navigation principale, modales de saisie/correction ;
- lecteur d'écran (TalkBack/VoiceOver) : parcours tâches → chronomètre → historique → export local ;
- partage système du fichier d'export local depuis l'appareil.

Ils seront repris tels quels dans l'état de livraison lors de la complétion DRC-05 ; ils ne bloquent pas la boucle autonome mais restent des limites consignées de la RC.

## Constats conservés

Tous les constats vivent dans `docs/RELEASE_STATUS.json.openFindings` :
- MOB-CYCLE32961708279-SEG reste le seul obligatoire actif (DRC-05) ;
- BE-CYCLE32961708279-F1/F2/F3 passent à `resolved` (documentation DRC-07 complète et auditable au cycle 33086880966) ;
- les facultatifs restent listés sous leur critère. Ils ne sont pas perdus ; les obligatoires bloquent la complétion de leur critère.
