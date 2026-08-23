# Prochain cycle OpenCode / Ox

Ce fichier est la mémoire opérationnelle réécrite par le directeur après chaque
cycle. Il ne remplace jamais `MAIN_PROMPT.md` ni les directives actives.

## État cumulatif

Le socle mobile de démonstration compile sur Android et les règles métier locales
sont testées. Le travail mobile accepté du cycle ponctuel `32672898477-1` a été
repris : extraction du reducer et 30 tests supplémentaires, soit 45 tests mobile
passants lors de ce cycle. Le backend reste volontairement non déployable.

Le candidat Firebase du même cycle n'est pas repris : son audit a relevé un
risque élevé, car 25 tests de règles étaient ignorés faute d'émulateur. Il reste
en quarantaine sur sa branche jusqu'à preuve humaine avec l'outillage requis.

## Priorité 1 — sécurité vérifiable

- Ne pas recréer ou intégrer automatiquement les règles Firebase non exécutées.
- Tester en logique pure les fonctions appelables : Auth, App Check, rôles,
  invitations, idempotence et concurrence.
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

Le directeur met à jour une unique branche cumulative et sa PR brouillon, sans
fusion automatique. Il écrit une décision machine lisible. La boucle continue
uniquement si les checks passent, qu'aucun risque critique/élevé ne reste ouvert
et qu'une nouvelle tranche bornée existe. La PR distingue : contrôles passés,
éléments non testés, risques résiduels et actions humaines requises.
