# ChoreScore Product Factory

ChoreScore utilise un seul workflow GitHub Actions : `.github/workflows/chorescore-factory.yml`.

## Lanes

Chaque run est un cycle autonome :

- **Mobile engineer** et **Backend engineer** travaillent en parallèle lorsque leur tâche est activée ;
- chaque candidat est transmis comme artefact temporaire à son **auditeur indépendant** ;
- les deux audits peuvent eux aussi travailler en parallèle ;
- une phase unique intègre uniquement les audits `accept`, exécute les checks complets, persiste l'état produit puis lance le **Release Director**.

Aucune branche candidate, audit ou recovery n'est créée. `lab/chorescore` est l'unique état produit cumulatif. `main` contient la constitution humaine et la factory.

## Routage des modèles gratuits

La factory ne dépend plus d'un modèle unique. Avant le travail produit, une matrice parallèle probe le pool gratuit OpenCode connu. Chaque probe lance réellement le modèle en mode headless et exige un appel outil `bash` pour lire un nonce inconnu. Un modèle qui répond en texte mais ne peut pas utiliser les outils est donc rejeté.

Le sélecteur choisit ensuite les modèles sains selon le rôle. Il favorise les modèles orientés code pour les ingénieurs et les modèles adaptés à la revue multi-fichiers pour les auditeurs/Directeur. Lorsque plusieurs modèles sont sains, l'auditeur d'une lane utilise de préférence un modèle différent du codeur.

La sélection est passée explicitement à chaque `opencode run --model ...`; le `model:` du frontmatter n'est qu'un fallback local.

Le pool de probe comprend les modèles gratuits récemment documentés ou encore routables par Zen. Les modèles disparus, 403/429, timeouts ou tool-call cassés sont automatiquement écartés pour le cycle.

## Continuité

Le workflow est planifié toutes les cinq minutes avec un seul groupe de concurrence et `cancel-in-progress: false`. Un cycle en cours n'est jamais annulé par le suivant ; GitHub conserve au plus un successeur en attente. Un run rouge n'efface aucune progression déjà poussée.

Chaque appel de travail réessaie les pannes transitoires. Après épuisement, le cycle suivant re-probe tout le pool et reprend depuis `lab/chorescore`.

## Intégration

Un candidat n'entre dans `lab/chorescore` que si son audit JSON strict est valide, vaut `accept` et ne contient aucun `mustFix: true`. Les checks application, export Android, Functions et audits de dépendances sont exécutés avant persistance.

Le code audité est poussé **avant** l'appel du Directeur : une panne Directeur ne peut donc pas faire perdre un progrès produit déjà validé.

## Livraison finale

Après DRC-05 et DRC-07, le mobile effectue une passe DRC-06 source-readiness auditée. Puis la factory construit l'APK release, l'installe sur Android API 35, coupe réseau Wi-Fi/data, démarre sans Metro, traverse onboarding, reprend un chrono après redémarrage et visite la navigation cœur.

Le SHA-256, le rapport runtime et l'APK sont conservés comme artefact 90 jours. DRC-06 ne devient `complete` qu'après cette preuve, puis la factory se désactive.
