# Prochain cycle accepté

## Jalon

`demo-rc` — application Android locale, persistante, honnête et révisable.

## État intégré au cycle 33111958796

- **DRC-06 passe à `in_progress`** : le codeur mobile a effectué la
  vérification source-readiness (verification-only, delta zéro). L'audit
  indépendant RUN_33111958796_MOBILE.json est `accept`, 0 `mustFix`. Le code
  produit est apte au build APK release : aucun placeholder/TODO/console.log,
  aucune dépendance réseau vers des services réels, config Android cohérente,
  démo câblée en dur en mode hors ligne, 164/164 tests, npm audit prod
  high = 0.
- **DRC-01 à DRC-05 complets** (depuis les cycles antérieurs).
- **DRC-07 complet** (depuis le cycle 33086880966).
- **`pendingArtifact` = `DRC-06`** — le shell de confiance est autorisé à
  construire, attester et publier l'APK release.
- **Les deux codeurs sont désactivés** — aucun travail source restant.

## Prochaine action

Le shell de confiance construit l'APK release depuis `lab/chorescore`,
l'installe sur Android API 35, coupe réseau Wi-Fi/data, démarre sans Metro,
traverse onboarding, reprend un chrono après redémarrage et visite la
navigation cœur. Le SHA-256 et le rapport runtime sont conservés comme
artefact. DRC-06 ne devient `complete` qu'après cette preuve.

## Contrôles manuels restants (explicitation DRC-05)

Conformément au résultat DRC-05 (« les contrôles manuels restants sont
explicités »), les contrôles suivants ne sont pas remplaçables par des
preuves déterministes et restent documentés comme résiduels de la démo :

- grandes tailles de texte système sur appareil réel : filtre membre en
  repli, navigation principale, modales de saisie/correction ;
- lecteur d'écran (TalkBack/VoiceOver) : parcours tâches → chronomètre →
  historique → export local ;
- partage système du fichier d'export local depuis l'appareil.

Ils sont repris tels quels dans l'état de livraison lors de la complétion
DRC-06 ; ils ne bloquent pas la boucle autonome mais restent des limites
consignées de la RC.

## Constats conservés

Tous les constats vivent dans `docs/RELEASE_STATUS.json.openFindings` :
- tous les constats obligatoires mobiles (MOB-C4-F1, MOB-C4-F2,
  MOB-CYCLE32961708279-SEG) et backend (BE-C4-F1, BE-C4-F2,
  BE-CYCLE32961708279-F1/F2/F3) sont résolus ;
- les facultatifs restent listés sous leur critère. Ils ne sont pas perdus ;
  les obligatoires bloquent la complétion de leur critère.
