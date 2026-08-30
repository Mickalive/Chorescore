# Décisions produit canoniques

1. ChoreScore est une **application mobile** Expo/React Native inspirée du modèle mental de Tricount appliqué au temps domestique.
2. L'utilisateur se connecte avec une identité de compte réelle en production : compte ChoreScore, Google ou Facebook. Son identité n'est pas un sélecteur local arbitraire.
3. Après connexion, l'écran racine affiche les **foyers** accessibles et permet d'en créer un si l'abonnement le permet.
4. Le gratuit conserve un foyer ; les foyers multiples sont premium.
5. Une fois un foyer ouvert, il existe exactement trois onglets principaux : **Ajouter une tâche | Score | To-do**.
6. `Historique`, `Classement`, `Bilan`, `Profil` et `Foyer` ne sont pas des onglets principaux supplémentaires dans un foyer.
7. Une réalisation domestique crée une **entrée historique indépendante** : libellé, membre auquel le travail est attribué, durée réelle, date/heure, foyer et options facultatives.
8. La durée est renseignée uniquement de deux façons : **manuellement** ou par **chrono**.
9. **1 minute réelle = 1 minute réelle.** Les minutes/heures restent toujours la métrique principale.
10. Une **tâche persistante** est facultative. Elle sert de raccourci de saisie et de catégorie analytique stable dans Score. Elle ne remplace jamais les entrées réalisées et n'est jamais une To-do.
11. Deux réalisations identiques créent toujours deux entrées historiques distinctes.
12. Une entrée sans tâche persistante reste visible individuellement dans l'historique et est classée sous **Autres** dans les analyses/filters par tâche.
13. La pondération est facultative, avancée, coefficient 1 par défaut et ne modifie jamais le temps réel. L'interface distingue heures réelles et heures pondérées ; aucun système de points abstraits.
14. **Score fusionne historique et métriques.** Il n'existe aucun écran Historique ou Classement séparé.
15. Score propose **Semaine / Mois / Année / Depuis le début**.
16. Score peut être filtré par **Toutes / chaque tâche persistante / Autres** ; le filtre s'applique aux métriques, graphes et entrées historiques affichées.
17. Avant le graphique réel, Score affiche pour chaque membre l'**avance ou retard en temps réel** par rapport à la part égale du temps du foyer : `tempsMembre - tempsTotal/nombreDeMembres`.
18. Score affiche ensuite un **graphique réel** des minutes/heures par membre, chaque membre ayant une couleur distincte et cohérente.
19. Lorsque la pondération est utilisée, Score affiche aussi l'**avance/retard pondéré** et un **second graphique pondéré** clairement secondaire.
20. Sous les métriques/graphes, Score affiche les entrées individuelles de la période et du filtre sélectionnés : cette liste constitue l'historique.
21. **To-do** est un planning séparé des entrées réalisées. Une To-do peut avoir libellé, membre assigné, deadline, notes, rappel/notification et état à faire/terminé.
22. Les To-do datées peuvent être synchronisées avec un calendrier lorsque cette intégration est réellement disponible.
23. Les notifications peuvent couvrir notamment nouvelles entrées, modifications/suppressions, nouvelles To-do assignées et échéances/rappels ; elles doivent être configurables.
24. Le modèle collaboratif par défaut est basé sur la confiance, comme Tricount : les membres d'un foyer peuvent ajouter/modifier/supprimer des entrées et gérer le planning pour les autres. Une offre premium peut permettre au propriétaire du foyer de définir des permissions fines.
25. Le compte/profil/réglages globaux sont accessibles via avatar/menu, pas comme onglet principal du foyer.
26. L'interface applique **KISS** : peu d'écrans, formulaires courts, peu de texte permanent, aucune interprétation morale/psychologique automatique des chiffres.
27. Direction visuelle : **feel-good, chaleureuse, contemporaine, pas enfantine**, avec fonds teintés et surfaces colorées douces ; éviter une application dominée par le blanc. Les couleurs membres doivent être distinctes, harmonieuses et accessibles pour les graphes.
28. Essai complet : 30 jours.
29. Premium ajoute notamment foyers multiples, pondération avancée, analyses avancées, export et permissions fines. Standard : 2,99 €/mois pour 1 à 7 personnes ; Pro : 5,99 €/mois à partir de 8 personnes, avec mêmes fonctionnalités cœur.
30. Une RC locale ne présente jamais comme réelle une connexion OAuth, une notification push, une synchronisation calendrier, un paiement ou une synchronisation réseau non configurés.

## Trois objets métier distincts

- `CompletedEntry` : occurrence réellement effectuée et historisée.
- `PersistentTask` : raccourci/catégorie analytique facultative.
- `TodoItem` : travail futur planifié.

Ces trois objets ne doivent jamais être fusionnés.
