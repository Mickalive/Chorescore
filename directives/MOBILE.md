# Tâche active — Ingénieur produit mobile

Assignment-Id: DRC-01
Autorité de poste : `governance/roles/MOBILE_PRODUCT_ENGINEER.md`
Sélecteur machine : `directives/TASKS.json`

## Contexte

La RC précédente est rejetée comme produit. La nouvelle constitution humaine est la source de vérité : ChoreScore est household-first et distingue strictement réalisation historique, tâche persistante facultative et future To-do.

## Hiérarchie produit obligatoire

### Niveau global

Après connexion en production : écran de **sélection des foyers**.

Pour la RC locale, conserver une représentation locale honnête de ce niveau sans prétendre qu'un OAuth ou backend inexistant est réel.

L'utilisateur choisit un foyer existant ou en crée un lorsque le plan le permet. Gratuit : un foyer ; foyers multiples : premium.

### Dans un foyer

Les trois onglets principaux sont exactement :

1. **Ajouter une tâche**
2. **Score**
3. **To-do**

Ne pas remplacer cela par `Accueil | Bilan | Foyer`. Ne pas créer d'onglets séparés Historique/Classement/Bilan.

## Tranche DRC-01 — Ajouter une tâche

Implémenter le nouveau modèle :

### CompletedEntry

Chaque réalisation crée une entrée indépendante contenant au minimum :
- foyer ;
- membre auquel le travail est attribué ;
- libellé ;
- durée réelle ;
- date/heure ;
- référence PersistentTask facultative ;
- pondération facultative/figée si utilisée.

Deux réalisations du même travail restent toujours deux entrées distinctes.

### Durée

Seulement deux modes :
- durée manuelle ;
- chrono.

Le chrono produit une CompletedEntry à l'arrêt.

### PersistentTask

L'utilisateur peut lors de l'ajout :
- laisser le libellé ponctuel ;
- sélectionner une PersistentTask existante ;
- rendre le nouveau libellé persistant.

PersistentTask sert uniquement à accélérer la saisie et à fournir une catégorie analytique stable pour Score. Elle n'est pas une réalisation et n'est pas une To-do.

Les CompletedEntry sans PersistentTask sont classées sous `Autres` dans les analyses de Score mais restent visibles individuellement dans l'historique.

### Pondération

Option avancée uniquement. Coefficient 1 par défaut. La durée réelle reste inchangée et affichée.

## Préparer les frontières futures sans les simuler

Le modèle final doit distinguer :
- `CompletedEntry` ;
- `PersistentTask` ;
- `TodoItem`.

DRC-01 n'a pas à implémenter toutes les fonctions To-do/Score, mais aucune décision de modèle ne doit empêcher les critères suivants.

Ne pas simuler comme réel : OAuth, push distant, calendrier, paiement, synchronisation réseau.

## UX

KISS. Dans l'onglet Ajouter une tâche : formulaire court, peu de texte, aucune catégorie ménagère obligatoire, aucune batterie de boutons, aucun commentaire moral.

Direction visuelle : feel-good, chaleureuse, contemporaine ; fonds teintés plutôt qu'une domination de blanc ; couleurs membres harmonieuses et distinctes ; accessibilité conservée.

## Compatibilité

Réutiliser persistance, chrono, isolation des foyers et validation lorsque pertinent. Migrer l'ancien schéma vers CompletedEntry/PersistentTask sans perte silencieuse. Ne pas conserver l'ancien modèle simplement pour minimiser le diff.

## Preuves attendues

Tests déterministes couvrant au minimum :
- sélection/création locale de foyer selon plan ;
- hiérarchie foyer -> Ajouter une tâche | Score | To-do ;
- CompletedEntry manuelle ;
- CompletedEntry via chrono ;
- deux réalisations identiques restent distinctes ;
- entrée ponctuelle sans PersistentTask ;
- sélection/création d'une PersistentTask facultative ;
- aucune fusion entre CompletedEntry, PersistentTask et TodoItem ;
- durée réelle intacte même avec pondération ;
- migration sans perte silencieuse ;
- persistance après reprise ;
- isolation entre foyers.
