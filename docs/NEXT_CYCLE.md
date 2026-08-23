# Prochain cycle OpenCode / Ox Alpha

Le socle mobile de démonstration compile sur Android et les règles métier locales sont testées. Le backend est volontairement non déployable tant que les contrôles ci-dessous ne sont pas terminés.

## Priorité 1 — sécurité vérifiable

- Ajouter `firestore.rules`, `storage.rules`, `firebase.json` et les tests d'émulateur négatifs entre deux foyers.
- Tester les fonctions appelables : Auth, App Check, rôles, invitations, idempotence et concurrence.
- Vérifier Stripe en mode test uniquement, notamment signature, rejeu,
  ancienneté et événements désordonnés ; empêcher explicitement qu'un ancien
  événement d'abonnement remplace un état plus récent.
- Documenter la rétention, la suppression et l'export des données.

## Priorité 2 — relier le client sans fragiliser la démo

- Conserver `demo` comme mode par défaut, totalement hors ligne.
- Concevoir un adaptateur Firebase production qui échoue fermé si une configuration manque.
- Ne jamais accepter du client le score, le rôle, l'abonnement ou l'heure serveur.
- Ajouter les flux Auth uniquement après les règles et tests d'isolation.

## Priorité 3 — qualité mobile

- Ajouter des tests d'interaction des quatre onglets, modales, erreurs et scénarios de plans.
- Vérifier VoiceOver/TalkBack, grandes tailles de texte et petits écrans.
- Produire un build de développement installable ; aucun déploiement store automatique.

## Critère de sortie

Le directeur de cycle ouvre une seule PR, sans fusion automatique. La PR doit distinguer clairement : contrôles passés, éléments non testés, risques résiduels et actions humaines requises.
