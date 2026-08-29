# Décisions produit canoniques

1. ChoreScore est une **application mobile** Expo/React Native.
2. Le concept est volontairement simple : **un Tricount des tâches ménagères**.
3. L'utilisateur crée ou choisit un **foyer** puis enregistre des **entrées de travail domestique**.
4. Une entrée contient au minimum : **nom libre de la tâche**, **personne**, **durée**, **foyer**, **date/heure**.
5. Le nom est toujours libre. Il n'existe **aucune catégorie obligatoire**, aucun catalogue de tâches et aucune obligation de créer une définition de tâche au préalable.
6. La durée peut être saisie manuellement ou obtenue avec un chrono. Un chrono terminé devient une entrée ordinaire du journal.
7. Le journal du foyer fonctionne comme un registre : ajout, modification et suppression d'entrées réelles.
8. Le bilan agrège les entrées par membre et période afin de rendre visible la contribution de chacun.
9. ChoreScore n'est pas une todo list et ne gère pas des tâches « à faire », « actives » ou « archivées » dans le parcours cœur.
10. Le foyer est un objet de premier rang : création, choix/changement de foyer, membres et isolation des données.
11. L'interface doit être légère et mobile : une action principale évidente pour ajouter une entrée, peu de texte permanent, pas de batterie de boutons sur chaque ligne, actions rares dans un menu/détail.
12. Le produit aide à objectiver la répartition des tâches avec un ton calme et factuel ; il n'humilie pas les membres et ne transforme pas le classement en jugement moral.
13. L'essai complet dure 30 jours.
14. Après l'essai, l'offre gratuite conserve un foyer, les entrées libres, la saisie manuelle/chrono, le bilan hebdomadaire au temps brut et l'accès à la semaine courante du lundi au dimanche.
15. Premium ajoute notamment pondération personnalisée, périodes/analyses avancées, export et foyers multiples.
16. Standard coûte 2,99 €/mois pour 1 à 7 personnes. Pro coûte 5,99 €/mois à partir de 8 personnes ; mêmes fonctionnalités, seule la taille change.
17. Si la pondération est active, le score vaut `(durée en secondes / 60) × poidsFigé`. En gratuit le poids effectif vaut 1 ; l'arrondi reste réservé à l'affichage.
18. La RC utilise uniquement des données locales, fonctionne hors ligne et ne simule jamais un paiement ou une synchronisation réelle.
19. Les données appartiennent aux personnes qui les créent. Les informations légales et de confidentialité restent dans les écrans appropriés et ne doivent pas encombrer le parcours principal.

## Direction visuelle

La palette peut servir de base mais n'est pas une obligation de composition. Le design doit privilégier hiérarchie, espace, typographie, lisibilité et simplicité plutôt que multiplier les cartes colorées.

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
