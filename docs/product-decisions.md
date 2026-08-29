# Décisions produit canoniques

1. ChoreScore est une **application mobile** Expo/React Native.
2. Le concept est volontairement simple : **un Tricount des tâches ménagères**.
3. L'utilisateur crée ou choisit un **foyer** puis enregistre des **entrées de travail domestique**.
4. Une entrée contient au minimum : **nom libre de la tâche**, **personne**, **durée réelle**, **foyer**, **date/heure**.
5. Le nom est toujours libre. Il n'existe aucune catégorie obligatoire, aucun catalogue de tâches et aucune obligation de créer une définition de tâche au préalable.
6. La durée peut être saisie manuellement ou obtenue avec un chrono. Un chrono terminé devient une entrée ordinaire.
7. **1 minute réelle reste 1 minute réelle.** Le temps affiché et stocké n'est jamais transformé.
8. Une pondération facultative peut exister uniquement dans `Options avancées` lors de l'ajout ou de la modification d'une entrée. Elle vaut 1 par défaut, reste invisible dans le parcours simple et ne sert qu'à une vue secondaire éventuelle. Le temps réel reste toujours la métrique principale.
9. L'application ne parle jamais de points comme métrique principale.
10. ChoreScore n'est pas une todo list et ne gère pas des tâches à faire, actives ou archivées dans le parcours cœur.
11. Le foyer est un objet de premier rang : création, choix/changement de foyer, membres et isolation des données.

## Navigation KISS

La navigation principale comporte **trois espaces maximum** :

1. **Accueil** — foyer actif, bouton principal `Ajouter`, éventuel chrono en cours et quelques dernières entrées.
2. **Bilan** — fusion complète de l'ancien Historique et de l'ancien Classement.
3. **Foyer** — membres, création/changement de foyer et réglages liés au foyer.

Il ne doit exister **ni onglet Historique séparé, ni onglet Classement séparé**.

## Écran Bilan

Le Bilan répond à une seule question : **où est passé le temps du foyer sur la période choisie ?**

En haut : sélecteur de période :
- **Semaine** ;
- **Mois** ;
- **Année** ;
- **Depuis le début**.

Ces quatre horizons font partie du produit de base et ne sont pas premium.

Ensuite : sélecteur simple :
- **Personnes** ;
- **Tâches**.

### Vue Personnes

Afficher pour chaque membre :
- temps réel sur la période ;
- part du temps total du foyer en pourcentage ;
- représentation graphique simple en barres.

### Vue Tâches

Regrouper les entrées ayant le même nom de tâche et afficher :
- nom de la tâche ;
- total de minutes/heures consacré à cette tâche sur la période ;
- représentation graphique simple en barres.

Le graphe doit toujours afficher les **minutes/heures directement**, pas seulement une proportion abstraite.

Sous le graphe, afficher la **liste chronologique des entrées de la période sélectionnée**. Cette liste est l'historique. Il n'y a donc aucune raison de créer un écran Historique séparé.

Les actions modifier/supprimer se font depuis une entrée, via un menu ou un écran de détail compact, pas via une rangée de gros boutons.

## UX

Principe : **KISS — Keep It Simple, Stupid.**

- une action principale évidente ;
- peu d'écrans ;
- peu de texte ;
- hiérarchie visuelle claire ;
- minutes/heures visibles ;
- graphes simples ;
- pas de cartes imbriquées inutilement ;
- pas de batterie de boutons ;
- aucune catégorie obligatoire ;
- aucun nom de tâche prédéfini obligatoire ;
- aucune interprétation automatique des chiffres.

L'application n'affiche aucun message du type « discutez des écarts », « ceci n'est pas un verdict », « votre contribution est... », conseil relationnel, encouragement, culpabilisation ou commentaire automatique sur l'équilibre. Elle montre les données et les actions, point.

## Offre

Essai complet : 30 jours.

Après l'essai, l'offre gratuite conserve :
- un foyer ;
- entrées libres ;
- durée manuelle ou chrono ;
- Bilan semaine / mois / année / depuis le début ;
- vues Personnes et Tâches en temps réel.

Premium ajoute notamment pondération avancée facultative, analyses comparatives plus poussées, export et foyers multiples.

Standard : 2,99 €/mois pour 1 à 7 personnes. Pro : 5,99 €/mois à partir de 8 personnes ; mêmes fonctionnalités, seule la taille change.

## RC locale

La RC utilise uniquement des données locales, fonctionne hors ligne, persiste foyers/membres/entrées/chrono et ne simule jamais un paiement ou une synchronisation réelle.

## Direction visuelle

La palette peut servir de base mais n'est pas une obligation de composition. Le design doit privilégier hiérarchie, espace, typographie, lisibilité et simplicité.

| Usage | Couleur |
| --- | --- |
| Fond doux | `#F1FAEE` |
| Bleu clair | `#A8DADC` |
| Texte principal | `#264653` |
| Texte secondaire | `#457B9D` |
| Action | `#2A9D8F` |
| Accent | `#E9C46A` |
| Attention | `#F4A261` |
| Erreur | `#E76F51` |
