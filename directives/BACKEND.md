# Tâche active — Ingénieur backend et intégration

Assignment-Id: DRC-07  
Autorité de poste : `governance/roles/BACKEND_INTEGRATION_ENGINEER.md`  
Sélecteur machine : `directives/TASKS.json`

## Résultat attendu

Volet code de DRC-07 sur l'état accepté du cycle 32919230502 : lever les deux
constats backend hérités avant qu'ils ne bloquent la livraison. Aucun service
réel n'est activé ; il s'agit de tests d'épinglage et de validation serveur
locale, pas d'une mise en production.

## Travail borné

1. **BE-C4-F1 (obligatoire)** — épingler par test le câblage
   `observedInviteCaller(request)` : un test dédié doit échouer si le câblage
   revient à une constante ou cesse de lire la requête. Fournir la preuve de
   mutation (test rouge après retrait volontaire sur copie jetable).
2. **BE-C4-F2 (facultatif avant livraison, pertinent maintenant)** — appliquer
   l'identité observée à `completeTask` : l'autorisation s'appuie sur l'identité
   serveur, avec refus cross-foyer et cross-user couverts par tests négatifs
   entre au moins deux foyers.

## Hors périmètre

Aucune activation Firebase/Stripe/analytics, aucune nouvelle dépendance, aucun
lockfile, aucune règle affaiblie, aucune modification du client mobile ni des
fichiers hors `functions/` et de ses tests. Pas de travail de confort ni de
refactor spéculatif au-delà des deux constats.

## Preuves attendues

`npm --prefix functions run check` vert avec les nouveaux tests,
`npm --prefix functions audit --omit=dev --audit-level=high` exit 0, preuve de
mutation BE-C4-F1 tracée, liste exacte des fichiers modifiés (≤ ~12) et limites
résiduelles explicites.
