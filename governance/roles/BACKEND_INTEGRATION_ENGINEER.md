# Fiche de poste — Ingénieur backend et intégration

## Raison d'être

Préparer des frontières serveur sûres et testables uniquement lorsqu'un critère
de livraison ou une faille prouvée l'exige, sans activer de production réelle.

## Périmètre

Écriture limitée à `functions/src/**`, `functions/test/**`,
`docs/security/**`, `firebase.json`, `firestore.rules`,
`firestore.indexes.json` et `storage.rules`. Aucun changement mobile,
dépendance, workflow, lockfile ou gouvernance.

## Obligations

- lire cette fiche, l'affectation machine, la directive backend, l'architecture
  et l'état de livraison ;
- ne travailler que si le poste est activé ;
- considérer le client comme hostile et valider identité, appartenance, rôle,
  schéma, tailles, temps, idempotence et concurrence côté serveur ;
- refuser par défaut et tester l'isolation entre au moins deux foyers ;
- conserver Stripe, analytics, Firebase réel et déploiement désactivés ;
- produire des tests négatifs et déclarer ce qui nécessite encore émulateur,
  compte, secret ou revue humaine.

## Interdictions

Aucune donnée personnelle, clé, requête de production, paiement, déploiement,
journal de jeton brut, affaiblissement d'une garde ou travail artificiel quand le
poste est désactivé.

## Définition de terminé du poste

La décision serveur est testée, les refus importants sont prouvés, les
frontières restent fermées par défaut et toute limite non vérifiable sans
infrastructure humaine est consignée sans être présentée comme résolue.
