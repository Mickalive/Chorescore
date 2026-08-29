# Tâche active — Ingénieur produit mobile

Assignment-Id: DRC-01
Autorité de poste : `governance/roles/MOBILE_PRODUCT_ENGINEER.md`
Sélecteur machine : `directives/TASKS.json`

## Contexte

La RC précédente est rejetée comme produit : elle a dérivé vers une liste de
tâches prédéfinies et une interface trop éditoriale. Le cycle 33278810674 a
échoué (candidat indisponible). Le même objectif reste prioritaire.

## Objectif de cette tranche

Construire le cœur **Tricount-like** de ChoreScore :

- créer ou choisir un foyer local et ses membres ;
- afficher un journal chronologique des entrées de ce foyer ;
- `Ajouter une entrée` avec **libellé libre**, **personne**, **durée réelle** ;
- permettre saisie manuelle ou chrono ;
- le chrono terminé produit une entrée autonome ;
- aucune catégorie obligatoire ;
- aucune métrique de points dans l'interface.

## Exigence de modèle — bloquante

**Supprimer l'entité métier persistante `TaskDefinition`.**

Une action domestique enregistrée est une entrée autonome, comme une dépense
dans Tricount. Chaque entrée doit porter directement le libellé nécessaire à
son affichage et à ses agrégations.

Le modèle final ne doit plus dépendre de `entry.taskId` vers une définition
de tâche pour afficher, corriger, persister ou agréger une entrée.

Si le schéma actuel contient `tasks[]`, `TaskDefinition` ou `entry.taskId`,
fournir une migration sûre qui transforme les anciennes données en entrées
autonomes en copiant le nom utile dans chaque entrée. Pas de perte silencieuse.

Deux saisies `Vaisselle` à deux dates différentes sont deux entrées distinctes.
Le regroupement `Vaisselle = X minutes` dans les graphes est calculé à la
volée depuis ces entrées ; il ne crée jamais un objet tâche.

Une suggestion de libellé récent peut être dérivée de l'historique pour
accélérer la saisie, mais ne doit pas devenir une entité administrable.

## Navigation — 3 onglets

Navigation cible : **Accueil | Bilan | Foyer** (3 onglets maximum).

- **Accueil** : foyer actif, bouton Ajouter, chrono en cours, dernières
  entrées.
- **Bilan** : Historique et Classement fusionnés. Périodes : semaine/mois/
  année/depuis le début. Vues Personnes et Tâches. Graphes avec minutes/heures.
  Liste chronologique des entrées sous les graphes.
- **Foyer** : membres, nom, créer/changer de foyer, réglages.

Supprimer les onglets `Classement` et `Historique` séparés. Supprimer tout
texte qui interprète ou commente les chiffres/personnes.

## Compatibilité

Réutiliser persistance, chrono, isolation des foyers et validation lorsque
pertinent, mais ne pas conserver une mauvaise abstraction uniquement pour
minimiser le diff.

## Preuves attendues

Tests déterministes couvrant au minimum :
- foyer créé/choisi ;
- entrée libre manuelle autonome ;
- chrono avec libellé libre ;
- deux entrées portant le même libellé restent deux entrées distinctes ;
- agrégation par libellé calculée depuis les entrées ;
- aucune dépendance métier à `TaskDefinition` / `entry.taskId` ;
- migration de l'ancien schéma sans perte silencieuse ;
- persistance après reprise ;
- isolation entre foyers ;
- navigation 3 onglets (Accueil/Bilan/Foyer) ;
- bilan avec les 4 périodes ;
- graphes Personnes et Tâches avec minutes/heures.
