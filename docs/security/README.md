# État sécurité du backend

Le dossier `functions/` est un **socle de développement**, pas un backend prêt à déployer. Il compile et ses règles métier pures sont testées, mais aucun environnement Firebase ou Stripe n'est configuré dans ce dépôt.

Avant tout déploiement, la boucle doit livrer et faire relire :

- des règles Firestore et Storage en refus par défaut, avec tests d'émulateur inter-foyers ;
- la configuration Firebase, App Check et les politiques de rétention/TTL ;
- des tests d'intégration des fonctions appelables, de concurrence et d'idempotence ;
- la vérification complète du webhook Stripe en environnement de test ;
- les parcours d'export, suppression et révocation du consentement ;
- une revue humaine indépendante et un test d'intrusion.

`STRIPE_ENABLED`, `STRIPE_LIVE_MODE` et `ANALYTICS_AGGREGATION_ENABLED` restent à `false` par défaut. Les secrets ne doivent être fournis qu'au runtime des Functions via le gestionnaire de secrets.

Le suivi prioritaire se trouve dans [`../NEXT_CYCLE.md`](../NEXT_CYCLE.md).
