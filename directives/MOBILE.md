# Tâche active — Ingénieur produit mobile

Assignment-Id: DRC-01
Autorité de poste : `governance/roles/MOBILE_PRODUCT_ENGINEER.md`
Sélecteur machine : `directives/TASKS.json`

## Source de vérité

Lire d'abord `MAIN_PROMPT.md` et `docs/product-decisions.md` depuis `main`. La RC précédente est rejetée comme produit.

## Niveau global : foyers

Après connexion en production : écran listant les foyers accessibles.

La création d'un foyer dépend d'un **quota numérique d'abonnement** (`householdLimit` ou équivalent). Il existe plusieurs paliers selon le nombre de foyers. **Ne jamais coder la règle `gratuit = 1 foyer / premium = plusieurs`.**

La RC locale peut utiliser une entitlement/config locale honnête, mais les valeurs/prix des paliers non présents dans la configuration canonique ne doivent pas être inventés.

## Dans un foyer : exactement 3 onglets

1. **Ajouter une tâche**
2. **Score**
3. **To-do**

## DRC-01 — Ajouter une tâche + historique

L'onglet Ajouter une tâche est l'équivalent de la vue dépenses Tricount.

En haut : formulaire court pour créer une `CompletedEntry` :
- libellé ;
- membre attribué ;
- durée réelle **manuelle ou chrono uniquement** ;
- date/heure ;
- `PersistentTask` facultative ;
- pondération facultative dans Options avancées.

Chaque réalisation est une entrée indépendante.

**Sous le formulaire, afficher tout l'historique chronologique du foyer.** L'historique n'est pas sous Score et n'a pas d'onglet séparé.

## Objets métier

- `CompletedEntry` : réalisation passée historisée.
- `PersistentTask` : raccourci/catégorie analytique facultative.
- `TodoItem` : tâche future.

Ne jamais les fusionner.

Les CompletedEntry sans PersistentTask restent visibles dans l'historique et relèvent de `Autres` dans Score.

## Préparer Score correctement

Score sera l'équivalent d'Équilibres dans Tricount, pas une liste historique : périodes semaine/mois/année/depuis le début, filtre PersistentTask/Autres, avance-retard réel, graphique réel, puis pondéré si utilisé.

Ne placer aucune liste d'historique sous Score.

## Préparer To-do correctement

TodoItem peut être datée ou non, assignée et avoir deadline/reminder. Lorsqu'elle est cochée comme faite, le flux final devra demander le temps passé puis créer une CompletedEntry. Ne prendre aucune décision de modèle qui empêche cette conversion.

## UX

KISS et feel-good : peu de blanc dominant, fonds teintés, couleurs membres distinctes, peu de texte, aucune interprétation morale des chiffres.

## Preuves DRC-01 attendues

- écran foyers et règle de création basée sur quota numérique de plan ;
- absence de hardcode `free=1/multi=premium` ;
- hiérarchie foyer -> Ajouter une tâche | Score | To-do ;
- CompletedEntry manuelle ;
- CompletedEntry par chrono ;
- deux réalisations identiques restent distinctes ;
- PersistentTask facultative ;
- historique complet sous Ajouter une tâche ;
- aucune liste historique sous Score ;
- durée réelle intacte avec pondération ;
- migration/persistance/isolation sans perte silencieuse.
