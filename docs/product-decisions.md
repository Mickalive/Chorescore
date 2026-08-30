# Décisions produit canoniques

1. ChoreScore V2 est une **reconstruction greenfield**. L'ancienne application et `lab/chorescore` restent des archives/réservoirs de briques ; aucun ancien écran, modèle, test ou service n'est repris automatiquement.
2. Une brique ancienne peut être réutilisée uniquement si elle est isolée, conforme au nouveau domaine, plus simple à adapter qu'à réécrire, retestée et acceptée par l'auditeur V2.
3. ChoreScore est une application mobile inspirée de Tricount, appliquée au temps domestique.
4. Après connexion, l'écran racine affiche les foyers accessibles, la création d'un foyer selon quota d'abonnement et un accès `Options`.
5. Le nombre de foyers créables dépend d'un quota numérique du plan (`householdLimit` ou équivalent). Ne jamais réduire la grille à `gratuit = 1 / premium = plusieurs`.
6. Les limites et prix exacts viennent de la configuration canonique de facturation et ne doivent pas être inventés.
7. Tout utilisateur a accès à Options pour réglages/notifs/légal/confidentialité ; le payeur/propriétaire voit en plus les options d'administration du foyer, abonnement/quota et permissions disponibles selon le plan.
8. Dans un foyer : exactement **Ajouter une tâche | Score | To-do**.
9. Ajouter une tâche contient la saisie puis **tout l'historique chronologique du foyer**.
10. Une `CompletedEntry` indépendante contient notamment : libellé, `performedByMemberId`, `beneficiaryMemberIds[]`, durée réelle, date/heure, foyer, PersistentTask facultative et pondération facultative.
11. `Fait par` sélectionne par défaut l'utilisateur connecté mais peut être changé pour n'importe quel membre du foyer sans changer l'identité de connexion.
12. `Fait pour` permet Tout le monde ou n'importe quel sous-ensemble non vide des membres du foyer.
13. La durée est renseignée uniquement manuellement ou par chrono. 1 minute réelle = 1 minute réelle.
14. Une `PersistentTask` est facultative et sert de raccourci + catégorie analytique. **Une PersistentTask = exactement un filtre Score.**
15. Les libellés non persistants ne créent jamais de filtres ; ils restent visibles dans l'historique complet et sont regroupés sous `Autres` dans Score.
16. La pondération est avancée, coefficient 1 par défaut, et produit des heures pondérées secondaires, jamais des points.
17. Score est l'équivalent d'Équilibres de Tricount enrichi de statistiques.
18. Score propose Semaine / Mois / Année / Depuis le début et filtre Toutes / chaque PersistentTask / Autres.
19. Pour une entrée de durée D faite par P pour N bénéficiaires, P reçoit +D et chaque bénéficiaire -D/N. Le solde d'un membre est la somme de ses crédits/charges ; la somme des soldes du foyer est zéro.
20. Les soldes positifs/négatifs servent à proposer simplement `qui doit rattraper combien auprès de qui`, comme les remboursements Tricount.
21. Score affiche aussi le temps réellement effectué par chaque membre et un graphique en barres avec noms + heures/minutes lisibles.
22. L'identité visuelle d'un membre ne dépend pas d'une couleur fixe : le nom porte l'identité ; la couleur ne sert qu'à la lisibilité du graphe.
23. La même logique fait-par/fait-pour est appliquée aux heures pondérées pour la section pondérée secondaire.
24. Sous les statistiques de Score, afficher l'historique **filtré par période + PersistentTask/Autres**. L'historique complet reste sous Ajouter une tâche.
25. To-do est le planning futur : tâches datées ou non, assignables, bénéficiaires éventuels, deadline, notes, reminders/notifs et calendrier lorsqu'il existe réellement.
26. Cocher une To-do comme faite ouvre un mini-formulaire : fait par (modifiable), durée réelle, fait pour ; puis crée une CompletedEntry et met à jour historique + Score.
27. Le partage utilise **uniquement le share sheet natif du système**. L'app prépare un texte, lien, image ou fichier puis ouvre le partage système ; Android/iOS proposent automatiquement les apps compatibles installées. Aucun SDK ni bouton spécifique Instagram/Facebook/TikTok/etc. n'est requis.
28. Le partage est contextuel : entrée/historique depuis Ajouter, Score courant/graphes/équilibres et historique filtré depuis Score, To-do/planning lorsque pertinent.
29. Les contenus partagés peuvent être des cartes ChoreScore attractives pour favoriser la viralité autour de la charge domestique, mais l'app n'invente jamais de jugement ou de culpabilisation.
30. Le modèle collaboratif par défaut est basé sur la confiance : les membres peuvent modifier les entrées et To-do des autres ; l'identité connectée reste fixe.
31. Les notifications sont configurables et peuvent couvrir réalisations, modifications, assignations et rappels.
32. OAuth, push, calendrier, paiement ou synchronisation réseau ne sont jamais simulés comme réels s'ils ne sont pas configurés.
33. Les frontières d'intégration sont prévues dès le socle via `AuthGateway`, `ShareGateway`, `NotificationGateway`, `CalendarGateway`, `PersistenceGateway`, `SyncGateway` et `BillingGateway`, sans coupler le domaine aux fournisseurs.
34. UX KISS : feel-good, chaleureuse, contemporaine, peu de blanc dominant, graphes lisibles, formulaires courts, aucun commentaire moral automatique.

## Trois objets métier distincts

- `CompletedEntry` : occurrence réellement effectuée et historisée, avec fait-par + fait-pour.
- `PersistentTask` : raccourci/catégorie analytique facultative et filtre Score.
- `TodoItem` : travail futur planifié.

Ces trois objets ne doivent jamais être fusionnés.
