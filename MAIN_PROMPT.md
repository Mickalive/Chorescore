# ChoreScore — constitution produit

## Principe

**KISS. ChoreScore est un Tricount du temps domestique, avec une To-do partagée.**

Une suite de tests verte ne valide pas un produit qui ne respecte pas cette constitution.

## 1. Connexion et foyers

En production, l'utilisateur se connecte avec son propre compte : compte ChoreScore, Google ou Facebook. Son identité n'est jamais un sélecteur local modifiable dans un foyer.

Après connexion, l'écran racine affiche uniquement :
- les foyers auxquels l'utilisateur appartient ;
- l'action `Créer un foyer` si son abonnement lui permet encore d'en créer un ;
- l'accès discret au compte/réglages.

**Le nombre de foyers autorisés dépend du palier d'abonnement.** Ne jamais simplifier en `gratuit = 1 / premium = plusieurs`.

Le modèle d'entitlement expose un quota explicite, par exemple `householdLimit`, et l'UI autorise la création tant que le nombre de foyers possédés/administrés soumis au quota reste inférieur à cette limite. Les valeurs/prix exacts des différents paliers viennent de la configuration canonique de facturation et ne doivent pas être inventés dans le code produit.

## 2. Dans un foyer : exactement 3 onglets

1. **Ajouter une tâche**
2. **Score**
3. **To-do**

Pas d'onglet Historique, Classement, Bilan, Profil ou Foyer supplémentaire.

## 3. Ajouter une tâche = saisie + historique

Cet onglet est l'équivalent de la liste des dépenses Tricount.

En haut : formulaire minimal pour enregistrer une réalisation :
- libellé ;
- durée **manuelle ou chrono**, uniquement ;
- membre auquel la réalisation est attribuée, avec utilisateur connecté par défaut ;
- date/heure ;
- tâche persistante facultative ;
- `Options avancées` pour la pondération facultative.

Chaque réalisation crée une **CompletedEntry indépendante**. Deux vaisselles à deux moments différents = deux entrées différentes.

Sous le formulaire : **tout l'historique chronologique du foyer**, comme les dépenses dans Tricount. Chaque ligne affiche simplement qui, quoi, combien de temps, quand. Modifier/supprimer via interaction compacte, pas une batterie de boutons.

### Tâche persistante

Une `PersistentTask` est facultative. Elle sert uniquement :
- de raccourci de saisie ;
- de catégorie stable pour filtrer/analyser Score ;
- éventuellement à mémoriser une pondération par défaut.

Elle n'est ni une réalisation ni une To-do. Une CompletedEntry peut référencer une PersistentTask, mais reste une occurrence indépendante.

Les entrées sans PersistentTask restent toutes visibles dans l'historique et sont regroupées analytiquement sous **Autres**.

### Temps et pondération

**1 minute réelle = 1 minute réelle.**

La durée réelle est toujours conservée et affichée. La pondération est facultative, cachée dans Options avancées, coefficient 1 par défaut. Elle produit éventuellement des **heures pondérées**, jamais des points abstraits.

## 4. Score = équivalent d'Équilibres dans Tricount

Score **ne contient pas l'historique** : l'historique est sous Ajouter une tâche.

Score répond à : qui a contribué davantage ou moins, et de combien faut-il rééquilibrer ?

### Périodes

- Semaine
- Mois
- Année
- Depuis le début

### Filtre

- Toutes
- chaque PersistentTask
- Autres

Le filtre agit sur tous les calculs de Score.

### Équilibre réel

Avant le graphique, afficher simplement l'écart de chaque membre à une répartition égale du temps sur la période/filtre :

`balance = tempsMembre - tempsTotal / nombreDeMembres`

Positif = avance de temps ; négatif = retard de temps.

Pour deux personnes, cela permet un affichage très direct de type : `A a 2 h 15 d'avance sur B` / `B a 2 h 15 à rattraper`.

Pour plusieurs personnes, afficher une représentation KISS de l'écart de chacun à la part égale ; si une formulation pair-à-pair est utilisée, elle doit rester mathématiquement cohérente et compréhensible.

### Graphique réel

Un graphique en barres montre les minutes/heures réelles par membre. Chaque membre a une couleur distincte, stable et accessible.

### Équilibre pondéré

Si la pondération est utilisée, afficher ensuite l'écart de chacun en **heures pondérées**, puis un second graphique en barres des heures pondérées. Cette section est clairement secondaire. Le réel reste toujours visible.

Aucun commentaire moral, conseil de couple, encouragement ou interprétation automatique.

## 5. To-do = planning futur

Une `TodoItem` est une chose à faire, séparée des CompletedEntry.

Elle peut être :
- sans date précise ;
- datée / avec deadline ;
- assignée à un membre ;
- accompagnée d'une note ;
- dotée d'un reminder/notification ;
- synchronisable avec un calendrier quand l'intégration réelle existe.

Les membres peuvent par défaut créer/modifier/assigner les To-do pour tout le foyer, sur un modèle de confiance partagé. Des permissions fines peuvent être fournies selon l'abonnement du propriétaire du foyer.

### Marquer une To-do comme faite

Chaque To-do possède une action de validation claire, par exemple un **check vert**.

Quand un membre marque la To-do comme faite :
1. l'app demande **combien de temps la tâche a pris** ;
2. l'utilisateur saisit la durée réelle ;
3. la To-do passe à terminée ;
4. l'app crée automatiquement une **CompletedEntry** dans le foyer, attribuée au membre qui l'a réalisée (modifiable selon les règles collaboratives) ;
5. cette nouvelle entrée apparaît immédiatement dans l'historique sous Ajouter une tâche et entre dans tous les calculs de Score.

Si la To-do est liée à une PersistentTask, la CompletedEntry conserve cette référence. Sinon elle est une entrée ponctuelle / Autres.

## 6. Trois objets distincts

- `CompletedEntry` = réalisation passée, historisée.
- `PersistentTask` = raccourci/catégorie analytique facultative.
- `TodoItem` = tâche future à faire.

Ne jamais fusionner ces concepts.

## 7. Collaboration et identité

L'identité connectée reste fixe. En revanche, comme Tricount, le modèle par défaut repose sur la confiance : un membre du foyer peut corriger les entrées et To-do des autres membres.

Les permissions fines sont une fonction d'abonnement/administration du foyer, pas une raison de compliquer le fonctionnement par défaut.

## 8. Notifications / calendrier

Les préférences peuvent couvrir :
- nouvelle réalisation ajoutée ;
- modification/suppression d'une réalisation ;
- nouvelle To-do assignée ;
- rappel/deadline ;
- autres événements explicitement utiles.

Elles sont configurables pour éviter le spam.

OAuth, push distant, calendrier, paiement et synchronisation réseau ne sont jamais simulés comme réels dans une RC locale.

## 9. Design

Direction : **feel-good, chaleureuse, contemporaine, énergique mais pas enfantine**.

- éviter l'application dominée par le blanc ;
- fonds teintés doux ;
- surfaces colorées légères ;
- couleurs distinctes et stables par membre ;
- graphes très lisibles ;
- typographie nette ;
- peu de texte ;
- pas de cartes imbriquées partout ;
- pas de commentaires éditoriaux sur les chiffres ;
- accessibilité/contrastes conservés.

L'ancienne palette n'est pas canonique : une nouvelle palette peut être conçue librement dans cette direction.

## 10. Critères de rejet immédiat

Rejeter tout candidat qui :
- met Ajouter/Score/To-do au niveau global plutôt qu'à l'intérieur d'un foyer ;
- crée un onglet Historique séparé ;
- place l'historique sous Score au lieu de sous Ajouter une tâche ;
- transforme Score en liste d'entrées au lieu d'un écran d'équilibre ;
- simplifie les abonnements en `1 foyer gratuit / multi-foyers premium` ;
- confond CompletedEntry, PersistentTask et TodoItem ;
- marque une To-do terminée sans demander le temps et créer une CompletedEntry ;
- remplace les heures par des points ;
- ajoute des messages moraux/relationnels ;
- rend l'UX inutilement complexe.

**Structure finale : Connexion -> Foyers -> [Ajouter une tâche + historique | Score/Équilibres | To-do].**
