# Tâche active — Ingénieur backend et intégration

Assignment-Id: DRC-07
Autorité de poste : `governance/roles/BACKEND_INTEGRATION_ENGINEER.md`
Sélecteur machine : `directives/TASKS.json`

## Résultat attendu

Volet documentation de DRC-07 sur l'état accepté du cycle 32961708279 :
`docs/security/README.md` est figé au cycle 32684730787 (37/37 tests, aucune
mention de l'identité observée) alors que le dépôt public expose désormais
l'extracteur pur `observedCaller(request)` câblé dans `createInvite`,
`redeemInvite` et `completeTask`, avec épinglage source dédié. La documentation
doit décrire exactement la réalité, sans surestimation. Aucun changement de
code ni de comportement.

## Travail borné

1. **Identité de l'appelant** — documenter `observedCaller`
   (`functions/src/observedCaller.ts`) : extraction pure depuis la requête
   brute, câblage des trois handlers, épinglage source
   (`functions/test/observedCallerWiring.test.ts`) et ses limites connues
   (épinglage textuel, handlers non exécutés bout en bout sans émulateur —
   constats BE-CYCLE32961708279-F2/F3) ; `completeTask` validé sur identité
   serveur observée avec refus négatifs cross-foyer/cross-user entre deux
   foyers.
2. **Contrôles exécutés** — remplacer la section datée 32684730787 par les
   mesures que vous exécutez vous-même sur l'arbre courant au moment de la
   rédaction (`npm --prefix functions run check`,
   `npm --prefix functions audit --omit=dev --audit-level=high`), datées du
   cycle. Chiffres mesurés, jamais copiés d'un rapport.
3. **Contrôles encore bloqués** — liste honnête et à jour : émulateur
   Firestore/Storage manquant (règles en quarantaine, handlers non exercés bout
   en bout), Stripe test, concurrence/idempotence réelles, rétention/TTL,
   revue humaine indépendante et test d'intrusion.

## Hors périmètre

Aucune modification hors `docs/security/**`. Aucun changement de code, de
règles, de dépendance, de lockfile ou d'orchestration. Aucune activation
Firebase/Stripe/analytics, aucun secret, aucun déploiement. Pas de travail de
confort au-delà de cette mise à jour.

## Preuves attendues

Sorties brutes des deux commandes de contrôle (mesurées ce cycle), diff limité
à `docs/security/**` (≤ ~2 fichiers), affirmation explicite des limites non
vérifiables sans infrastructure humaine.
