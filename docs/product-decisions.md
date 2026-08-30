# Décisions produit canoniques

1. ChoreScore est une application mobile inspirée de Tricount, appliquée au temps domestique.
2. Après connexion, l'écran racine affiche les foyers accessibles, la création d'un foyer selon quota d'abonnement et un accès `Options`.
3. Le nombre de foyers créables dépend d'un quota numérique du plan (`householdLimit` ou équivalent). Ne jamais réduire la grille à `gratuit = 1 / premium = plusieurs`.
4. Les limites et prix exacts viennent de la configuration canonique de facturation et ne doivent pas être inventés.
5. Tout utilisateur a accès à Options pour réglages/notifs/légal/confidentialité ; le payeur/propriétaire voit en plus les options d'administration du foyer, abonnement/quota et permissions disponibles selon le plan.
6. Dans un foyer : exactement **Ajouter une tâche | Score | To-do**.
7. Ajouter une tâche contient la saisie puis **tout l'historique chronologique du foyer**.
8. Une `CompletedEntry` indépendante contient notamment : libellé, `performedByMemberId`, `beneficiaryMemberIds[]`, durée réelle, date/heure, foyer, PersistentTask facultative et pondération facultative.
9. `Fait par` sélectionne par défaut l'utilisateur connecté mais peut être changé pour n'importe quel membre du foyer sans changer l'identité de connexion.
10. `Fait pour` permet Tout le monde ou n'importe quel sous-ensemble non vide des membres du foyer.
11. La durée est renseignée uniquement manuellement ou par chrono. 1 minute réelle = 1 minute réelle.
12. Une `PersistentTask` est facultative et sert de raccourci + catégorie analytique. **Une PersistentTask = exactement un filtre Score.**
13. Les libellés non persistants ne créent jamais de filtres ; ils restent visibles dans l'historique complet et sont regroupés sous `Autres` dans Score.
14. La pondération est avancée, coefficient 1 par défaut, et produit des heures pondérées secondaires, jamais des points.
15. Score est l'équivalent d'Équilibres de Tricount enrichi de statistiques.
16. Score propose Semaine / Mois / Année / Depuis le début et filtre Toutes / chaque PersistentTask / Autres.
17. Pour une entrée de durée D faite par P pour N bénéficiaires, P reçoit +D et chaque bénéficiaire -D/N. Le solde d'un membre est la somme de ses crédits/charges ; la somme des soldes du foyer est zéro.
18. Les soldes positifs/négatifs servent à proposer simplement `qui doit rattraper combien auprès de qui`, comme les remboursements Tricount.
19. Score affiche aussi le temps réellement effectué par chaque membre et un graphique en barres avec noms + heures/minutes lisibles.
20. L'identité visuelle d'un membre ne dépend pas d'une couleur fixe : le nom porte l'identité ; la couleur ne sert qu'à la lisibilité du graphe.
21. La même logique fait-par/fait-pour est appliquée aux heures pondérées pour la section pondérée secondaire.
22. Sous les statistiques de Score, afficher l'historique **filtré par période + PersistentTask/Autres**. L'historique complet reste sous Ajouter une tâche.
23. To-do est le planning futur : tâches datées ou non, assignables, bénéficiaires éventuels, deadline, notes, reminders/notifs et calendrier lorsqu'il existe réellement.
24. Cocher une To-do comme faite ouvre un mini-formulaire : fait par (modifiable), durée réelle, fait pour ; puis crée une CompletedEntry et met à jour historique + Score.
25. Le partage natif est facile et contextuel : entrée/historique depuis Ajouter, Score courant/graphes/équilibres et historique filtré depuis Score, To-do/planning lorsque pertinent.
26. Les contenus partagés peuvent être des cartes ChoreScore attractives pour favoriser la viralité / le partage autour de la charge domestique, mais l'app n'invente jamais de jugement ou de culpabilisation.
27. Le modèle collaboratif par défaut est basé sur la confiance : les membres peuvent modifier les entrées et To-do des autres ; l'identité connectée reste fixe.
28. Les notifications sont configurables et peuvent couvrir réalisations, modifications, assignations et rappels.
29. OAuth, push, calendrier, paiement ou synchronisation réseau ne sont jamais simulés comme réels s'ils ne sont pas configurés.
30. UX KISS : feel-good, chaleureuse, contemporaine, peu de blanc dominant, graphes lisibles, formulaires courts, aucun commentaire moral automatique.

## Trois objets métier distincts

- `CompletedEntry` : occurrence réellement effectuée et historisée, avec fait-par + fait-pour.
- `PersistentTask` : raccourci/catégorie analytique facultative et filtre Score.
- `TodoItem` : travail futur planifié.

Ces trois objets ne doivent jamais être fusionnés.
