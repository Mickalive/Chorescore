# ChoreScore

Application mobile Expo/React Native pour mesurer et mieux répartir les tâches d'un foyer, sans culpabilisation.

Le dépôt démarre volontairement en **mode démo local** : les personnes, tâches et abonnements sont fictifs, aucun compte n'est créé, aucune donnée n'est envoyée et aucun paiement n'est déclenché.

## Démo mobile

Prérequis : Node.js 22+, npm et l'application Expo Go, ou un simulateur iOS/Android.

```bash
npm install
npm run start
```

Scannez ensuite le QR code avec Expo Go. Les commandes `npm run ios` et `npm run android` ouvrent directement un simulateur configuré.

La démo couvre :

- un onboarding clair avec consentement analytique facultatif et désactivé par défaut ;
- la création manuelle d'une tâche et un chronomètre ;
- le calcul `minutes × poids`, avec le poids figé sur la tâche terminée ;
- les quatre onglets Tâches, Classement, Historique et Profil ;
- les scénarios essai 30 jours, gratuit, Standard et Pro ;
- un paywall informatif, sans achat réel ni interface manipulatrice.

## Vérifications

```bash
npm run typecheck
npm test
npm run functions:check
npm run audit:prod
```

`npm run check` exécute le typage et les tests de l'application. Les dépendances sont également contrôlées en CI.

## Modes de données

`EXPO_PUBLIC_DATA_MODE=demo` est le seul mode actif par défaut. Le mode production doit être explicitement configuré, puis branché aux fonctions serveur Firebase. Il échoue de façon fermée si la configuration manque.

Les valeurs `EXPO_PUBLIC_FIREBASE_*` sont des identifiants publics Firebase, pas des secrets. Les secrets Stripe et les clés d'administration restent exclusivement dans le gestionnaire de secrets du backend ; ils ne doivent jamais utiliser le préfixe `EXPO_PUBLIC_`.

## Modèle produit

| Offre | Taille du foyer | Fonctionnalités |
| --- | ---: | --- |
| Essai | toute taille | toutes, pendant 30 jours |
| Gratuit | toute taille | suivi, durée, classement au temps brut, historique glissant 30 jours |
| Standard | 1 à 7 personnes | toutes, 2,99 €/mois par foyer |
| Pro | 8 personnes et plus | toutes, 5,99 €/mois par foyer |

Les tarifs affichés sont des décisions produit de la démo ; la source d'autorité en production devra être Stripe côté serveur.

## Sécurité et confidentialité

La démo ne contient ni secret, ni écriture réseau, ni donnée personnelle réelle. Pour une mise en production, consultez [SECURITY.md](./SECURITY.md) et [docs/security](./docs/security). Un audit automatisé réduit le risque, mais ne remplace pas une revue humaine et un test d'intrusion avant de traiter des comptes, des données réelles ou des paiements.

## Organisation

- `app/` : routes et écrans Expo Router ;
- `src/domain/` : règles métier pures et testées ;
- `src/services/` : frontière entre données de démonstration et production ;
- `functions/` : opérations privilégiées, validation et webhooks ;
- `.opencode/` : agents spécialisés et commandes OpenCode/Ox ;
- `.github/` : CI, règles de contribution et automatisation de maintenance.

La boucle GitHub multi-runner se lance manuellement avec le workflow
`ChoreScore OpenCode Ox cycle`. Elle produit deux candidats isolés, un audit
indépendant, puis une seule PR d'intégration jamais fusionnée automatiquement.
Elle reste désactivée tant que la variable privée
`ENABLE_OPENCODE_OX_ALPHA=true` n'a pas été configurée après lecture de
[`docs/agent-workflow.md`](./docs/agent-workflow.md).

Ce projet est privé et propriétaire. Aucun droit de redistribution n'est accordé.
