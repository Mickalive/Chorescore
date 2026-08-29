# Tâche active — Ingénieur produit mobile

Assignment-Id: DRC-01
Autorité de poste : `governance/roles/MOBILE_PRODUCT_ENGINEER.md`
Sélecteur machine : `directives/TASKS.json`

## Contexte

La RC précédente est rejetée comme produit : elle a dérivé vers une liste de tâches prédéfinies et une interface trop éditoriale. Les briques techniques utiles doivent être conservées, mais le parcours doit être réaligné sur `MAIN_PROMPT.md` et `docs/product-decisions.md`.

## Objectif de cette tranche

Construire le cœur **Tricount-like** de ChoreScore :

- créer ou choisir un foyer local et ses membres ;
- afficher un journal chronologique des entrées de ce foyer ;
- `Ajouter une entrée` avec **nom libre**, **personne**, **durée réelle** ;
- permettre soit une saisie manuelle, soit un chrono associé à ce nom libre ;
- le chrono terminé produit une entrée ordinaire ;
- aucune catégorie obligatoire ;
- aucune `TaskDefinition` à administrer avant de saisir une activité ;
- aucune liste de tâches actives/archivées dans le parcours principal ;
- aucune métrique de points dans l'interface.

La pondération peut rester comme **option avancée facultative**, coefficient 1 par défaut, sans modifier ni masquer le temps réel.

## UX obligatoire

L'interface doit être restructurée, pas seulement recolorée. Une entrée de journal doit être compacte et lisible. Les actions rares (modifier/supprimer) ne doivent pas apparaître comme une batterie de gros boutons. Supprimer les textes automatiques qui interprètent ou commentent les chiffres/personnes (`discutez des écarts`, `pas un verdict`, feedback personnel, conseils relationnels, etc.). L'application affiche les faits et les actions, pas une opinion.

## Compatibilité

Réutiliser les briques déjà solides (persistance, chrono, isolation des foyers, validation) lorsque cela reste pertinent. Toute évolution de schéma doit avoir une migration ou une récupération explicite ; pas de perte silencieuse des données locales.

## Preuves attendues

Tests déterministes couvrant au minimum : foyer créé/choisi, entrée libre manuelle, chrono avec nom libre, journal mis à jour, durée réelle conservée, persistance après reprise, isolation entre foyers, absence de dépendance à une catégorie/définition de tâche.
