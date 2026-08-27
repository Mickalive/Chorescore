# ChoreScore Product Factory

ChoreScore utilise un seul workflow GitHub Actions : `.github/workflows/chorescore-factory.yml`.

## Lanes

Chaque run est un cycle autonome :

- **Mobile engineer** et **Backend engineer** travaillent en parallèle lorsque leur tâche est activée ;
- chaque candidat est transmis comme artefact temporaire à son **auditeur indépendant** ;
- les deux audits peuvent eux aussi travailler en parallèle ;
- une phase unique intègre uniquement les audits `accept`, exécute les checks complets, persiste l'état produit puis lance le **Release Director**.

Aucune branche candidate, audit ou recovery n'est créée. `lab/chorescore` est l'unique état produit cumulatif. `main` contient la constitution humaine et la factory.

## Continuité

Le workflow est planifié toutes les cinq minutes avec un seul groupe de concurrence et `cancel-in-progress: false`. Un cycle en cours n'est jamais annulé par le suivant ; GitHub conserve au plus un successeur en attente. Un run rouge n'efface aucune progression déjà poussée.

Ox (`opencode/x-preview-f-free`) est le seul modèle. Chaque appel réessaie les pannes transitoires ; après épuisement, le run suivant reprend la même lane depuis `lab/chorescore`.

## Intégration

Un candidat n'entre dans `lab/chorescore` que si son audit JSON strict est valide, vaut `accept` et ne contient aucun `mustFix: true`. Les checks application, export Android, Functions et audits de dépendances sont exécutés avant persistance.

Le code audité est poussé **avant** l'appel du Directeur : une panne Directeur ne peut donc pas faire perdre un progrès produit déjà validé.

## Livraison finale

Après DRC-05 et DRC-07, le mobile effectue une passe DRC-06 source-readiness auditée. Puis la factory construit l'APK release, l'installe sur Android API 35, coupe réseau Wi-Fi/data, démarre sans Metro, traverse onboarding, reprend un chrono après redémarrage et visite la navigation cœur.

Le SHA-256, le rapport runtime et l'APK sont conservés comme artefact 90 jours. DRC-06 ne devient `complete` qu'après cette preuve, puis la factory se désactive.
