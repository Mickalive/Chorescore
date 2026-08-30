# Décisions produit canoniques

1. ChoreScore est une application mobile inspirée de Tricount, appliquée au temps domestique.
2. Après connexion, l'écran racine affiche les foyers accessibles à l'utilisateur.
3. Le nombre de foyers créables dépend d'un **quota d'abonnement explicite** (`householdLimit` ou équivalent). Il existe plusieurs paliers selon le nombre de foyers ; ne jamais réduire cela à `gratuit = 1 foyer / premium = plusieurs`.
4. Les valeurs et prix exacts des paliers sont des données de configuration de facturation et ne doivent pas être inventés dans le code produit.
5. Une fois un foyer ouvert, il existe exactement trois onglets : **Ajouter une tâche | Score | To-do**.
6. `Ajouter une tâche` contient en haut la saisie d'une réalisation et, juste en dessous, **tout l'historique chronologique du foyer**, comme les dépenses dans Tricount.
7. Une réalisation crée une `CompletedEntry` indépendante : libellé, membre, durée réelle, date/heure, foyer et options facultatives.
8. La durée est renseignée uniquement manuellement ou par chrono.
9. 1 minute réelle = 1 minute réelle.
10. Une `PersistentTask` est facultative : raccourci de saisie + catégorie analytique stable. Elle n'est ni une réalisation ni une To-do.
11. Les entrées sans PersistentTask restent visibles dans l'historique et relèvent de `Autres` dans Score.
12. La pondération est facultative, avancée, coefficient 1 par défaut ; elle produit des heures pondérées secondaires, jamais des points.
13. **Score est l'équivalent d'Équilibres dans Tricount.** Il ne contient pas l'historique.
14. Score propose Semaine / Mois / Année / Depuis le début et le filtre Toutes / chaque PersistentTask / Autres.
15. Score affiche d'abord l'avance/retard réel de chaque membre par rapport à une répartition égale du temps, puis un graphique réel en barres par membre.
16. Lorsque la pondération est utilisée, Score affiche ensuite avance/retard pondéré puis un second graphique pondéré.
17. Chaque membre possède une couleur distincte, stable et accessible dans les graphes.
18. **To-do** est le planning futur du foyer : tâches avec ou sans date, assignables, deadline facultative, notes, rappels/notifications et synchronisation calendrier lorsque réellement disponible.
19. Une To-do possède une action de validation claire (check vert). Lorsqu'elle est cochée comme faite, l'app demande le temps passé, marque la To-do terminée et crée automatiquement une CompletedEntry correspondante.
20. Cette CompletedEntry apparaît immédiatement dans l'historique sous Ajouter une tâche et entre dans Score.
21. Le modèle collaboratif par défaut est fondé sur la confiance : les membres peuvent modifier les entrées et To-do des autres. Des permissions fines peuvent être fournies selon l'abonnement du propriétaire du foyer.
22. L'identité connectée reste fixe ; on ne change pas arbitrairement qui l'on est dans l'app.
23. Les notifications peuvent couvrir nouvelles réalisations, modifications, nouvelles To-do assignées et rappels/deadlines ; elles sont configurables.
24. OAuth, push, calendrier, paiement ou synchronisation réseau ne sont jamais simulés comme réels lorsqu'ils ne sont pas configurés.
25. UX KISS : peu d'écrans, formulaires courts, aucune interprétation morale/psychologique des chiffres.
26. Direction visuelle : feel-good, chaleureuse, contemporaine, pas enfantine ; fonds teintés, peu de blanc dominant, couleurs membres harmonieuses et distinctes.

## Trois objets métier distincts

- `CompletedEntry` : occurrence réellement effectuée et historisée.
- `PersistentTask` : raccourci/catégorie analytique facultative.
- `TodoItem` : travail futur planifié.

Ces trois objets ne doivent jamais être fusionnés.
