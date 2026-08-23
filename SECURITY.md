# Sécurité de ChoreScore

La branche principale démarre exclusivement en mode `demo`. Ce mode utilise des
données fictives, ne demande aucun secret, n'effectue aucun paiement et n'envoie
aucune donnée vers Firebase, Stripe ou un outil d'analytics.

Ne publiez jamais de clé privée, secret Stripe, compte de service Firebase ou
fichier `.env`. Les variables `EXPO_PUBLIC_*` sont intégrées au bundle et ne
doivent contenir aucun secret.

Le mode production ne doit être activé qu'après :

- configuration d'un projet Firebase séparé ;
- déploiement des règles Firestore et des Functions de ce dépôt ;
- configuration d'App Check et des secrets serveur ;
- tests d'isolation multi-foyers ;
- revue juridique des conditions et consentements ;
- audit des dépendances et pentest indépendant avant données ou paiements réels.

Pour signaler une vulnérabilité, utilisez un canal privé auprès du propriétaire
du dépôt. N'ouvrez pas d'issue publique contenant des détails exploitables.
