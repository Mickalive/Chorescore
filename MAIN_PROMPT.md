# ChoreScore — constitution produit et technique

## Autorité

Ce fichier est le **prompt maître stable de ChoreScore**. Tous les agents le lisent avant d'agir. Une suite de tests verte ne vaut jamais validation si le produit livré ne correspond pas à cette constitution.

Ordre d'autorité : sécurité/droit > ce prompt > `governance/RELEASE_DEFINITION.json` > `docs/product-decisions.md` et architecture > rôle > tâche active.

# Produit canonique — KISS

**ChoreScore est un Tricount du temps domestique, complété par un planning To-do.**

Le produit est organisé d'abord autour des **foyers**. L'utilisateur se connecte avec son identité personnelle, choisit un foyer auquel il appartient, puis travaille à l'intérieur de ce foyer.

## Identité et connexion

En production, l'utilisateur possède une identité de compte réelle :
- compte ChoreScore ;
- connexion Google ;
- connexion Facebook.

L'identité connectée n'est pas un sélecteur local : on ne peut pas changer arbitrairement « qui je suis » depuis un foyer.

Le modèle collaboratif par défaut est fondé sur la confiance, comme Tricount : les membres d'un même foyer peuvent ajouter, corriger et supprimer les entrées réalisées et gérer le planning pour les autres membres. Une offre premium peut permettre au créateur/propriétaire du foyer de définir des permissions plus fines par membre.

# Niveau 1 — Sélection des foyers

L'écran d'entrée après connexion affiche les foyers accessibles à l'utilisateur et permet d'en ouvrir un.

Il permet également de créer un nouveau foyer lorsque l'abonnement le permet.

Le plan gratuit conserve **un foyer**. Les foyers multiples sont une fonction premium selon l'offre canonique.

Le compte/profil/réglages globaux sont accessibles via avatar/menu, pas comme un onglet principal du foyer.

# Niveau 2 — Dans un foyer : exactement 3 onglets principaux

Une fois un foyer sélectionné, la navigation principale du foyer est :

1. **Ajouter une tâche**
2. **Score**
3. **To-do**

Il ne doit pas exister d'onglets séparés `Historique`, `Classement`, `Bilan`, `Profil` ou `Foyer` dans cette navigation principale.

Le changement de foyer se fait en remontant vers le sélecteur de foyers ou via le sélecteur de foyer dans l'en-tête.

# 1. Ajouter une tâche — enregistrer ce qui a réellement été fait

Le cœur reste celui de Tricount : chaque action réalisée crée une **entrée historique indépendante**.

Une entrée réalisée contient au minimum :
- un libellé libre ;
- le membre auquel le travail est attribué ;
- la durée réelle ;
- le foyer ;
- la date/heure ;
- éventuellement une référence à une tâche persistante facultative ;
- éventuellement une pondération avancée facultative ;
- l'identité du membre ayant créé/modifié l'entrée pour la traçabilité si nécessaire.

Exemple : `Vaisselle — Mickael — 18 min — 30 août` est une entrée. Une nouvelle vaisselle demain crée **une nouvelle entrée**, jamais la réutilisation d'un objet historique.

## Durée

Il n'existe que deux moyens de renseigner la durée :
- **durée manuelle** ;
- **chrono**.

Pas de troisième mode inutile.

**1 minute réelle = 1 minute réelle.** La durée réelle est toujours conservée et affichée telle quelle.

## Tâche persistante facultative

Lors de l'ajout d'une entrée, l'utilisateur peut :
- saisir simplement un libellé ponctuel ;
- sélectionner une tâche persistante existante ;
- transformer le libellé en **tâche persistante** pour le foyer.

Une tâche persistante sert uniquement à :
- accélérer les prochaines saisies ;
- donner une catégorie analytique stable dans Score ;
- permettre de filtrer les entrées et scores sur cette tâche précise.

Une tâche persistante **n'est pas** une occurrence réalisée et **n'est pas** une To-do. Elle n'a pas de statut `faite/à faire`, ne remplace jamais les entrées historiques et ne fusionne jamais plusieurs réalisations en une seule entrée.

Les entrées qui ne référencent aucune tâche persistante restent visibles individuellement dans l'historique mais sont regroupées analytiquement sous **Autres** dans les vues/filters par tâche.

## Pondération facultative

La pondération est cachée dans `Options avancées` lors de l'ajout/modification d'une entrée ou dans la configuration d'une tâche persistante si cela simplifie la réutilisation.

Elle vaut `1` par défaut. Elle ne modifie jamais la durée réelle.

Le produit distingue toujours :
- **heures réelles** ;
- **heures pondérées**, uniquement comme métrique secondaire.

Aucun « point » abstrait dans l'interface.

# 2. Score — historique + métriques + équilibre

**Score remplace et fusionne complètement les anciens concepts Historique / Classement / Bilan.**

Score contient à la fois les métriques et la liste des entrées historiques correspondantes.

## Périodes cœur

Sélecteur :
- **Semaine** ;
- **Mois** ;
- **Année** ;
- **Depuis le début**.

Ces quatre périodes font partie du produit de base.

## Filtre par tâche

Score permet de filtrer :
- **Toutes** ;
- chaque **tâche persistante** du foyer ;
- **Autres** pour toutes les entrées non persistantes.

Le filtre agit sur les métriques, les graphiques et l'historique affiché.

## Équilibre réel — avant le graphique

Pour chaque membre, Score affiche d'abord simplement son **avance ou retard en heures réelles** par rapport à une répartition égale du temps entre les membres du foyer sur la période filtrée.

Calcul KISS :
- `partEgale = tempsTotalFoyer / nombreDeMembres` ;
- `balanceReelleMembre = tempsReelMembre - partEgale`.

Valeur positive = avance ; valeur négative = retard. Afficher en heures/minutes compréhensibles.

## Graphique réel

Afficher ensuite un graphique simple comparant les **heures/minutes réelles par membre**, avec une couleur distincte et cohérente pour chaque membre.

Les valeurs de temps doivent rester directement lisibles.

## Équilibre pondéré — avant le graphique pondéré

Lorsque la pondération est pertinente, afficher également l'avance/retard en **heures pondérées**, calculé de la même façon à partir des durées pondérées.

Les heures réelles restent visibles et ne sont jamais remplacées.

## Graphique pondéré

Afficher un second graphique simple comparant les **heures pondérées par membre**.

Il doit être clairement identifié comme pondéré et rester secondaire par rapport au temps réel.

## Historique dans Score

Sous les métriques/graphes, afficher la liste chronologique des **entrées individuelles** de la période et du filtre choisis.

Chaque réalisation reste une ligne distincte, comme chaque dépense dans Tricount.

Les membres du foyer peuvent, dans le modèle de confiance par défaut, modifier/supprimer ces entrées, y compris celles attribuées à d'autres membres. L'identité de connexion ne change pas pour autant.

# 3. To-do — planning du foyer

La To-do est volontairement séparée des entrées réalisées.

Une To-do représente quelque chose **à faire dans le futur** et peut contenir :
- libellé ;
- membre assigné ;
- deadline/date ;
- notes facultatives ;
- rappel/notification facultatif ;
- état à faire / terminé ;
- synchronisation calendrier lorsque disponible.

Les membres du foyer peuvent par défaut créer, modifier, assigner et réorganiser les To-do pour les autres membres, sur le modèle de confiance partagé.

Le propriétaire premium peut éventuellement restreindre ces permissions.

## Calendrier

Une To-do datée peut être synchronisée avec le calendrier de l'utilisateur lorsque l'intégration calendrier est activée.

La synchronisation doit rester compréhensible et réversible ; aucune fausse synchronisation de démonstration ne doit être présentée comme réelle.

## Notifications et rappels

Les notifications ne sont pas limitées aux deadlines To-do. Les préférences du foyer/utilisateur peuvent notamment couvrir :
- nouvelle entrée réalisée ajoutée ;
- entrée réalisée modifiée/supprimée ;
- nouvelle To-do assignée ;
- échéance/rappel To-do ;
- autres événements utiles explicitement définis.

Elles doivent être configurables afin d'éviter le spam.

# Trois objets métier à ne jamais confondre

1. **CompletedEntry / entrée réalisée** : fait historique immuable en tant qu'occurrence ; une réalisation = une entrée.
2. **PersistentTask / tâche persistante** : raccourci + catégorie analytique facultative ; jamais une réalisation, jamais une To-do.
3. **TodoItem / To-do** : travail futur planifié avec attribution/deadline/reminder éventuels.

Toute architecture qui fusionne ces trois concepts doit être rejetée.

# UX — KISS

Le produit doit être immédiatement compréhensible sans texte explicatif permanent.

- peu d'écrans ;
- hiérarchie simple : foyers -> foyer sélectionné -> Ajouter / Score / To-do ;
- une action principale évidente ;
- formulaires courts ;
- aucune catégorie obligatoire ;
- graphes simples et lisibles ;
- minutes/heures visibles ;
- pas de batterie de boutons par ligne ;
- modifier/supprimer via menu/détail compact ;
- aucune interprétation morale ou relationnelle automatique des chiffres.

Aucun message du type `discutez des écarts`, `ceci n'est pas un verdict`, conseil relationnel, culpabilisation, encouragement ou commentaire automatique sur les personnes. L'application affiche les faits et les actions.

# Direction visuelle

L'ancienne palette blanche/bleu-vert n'est plus canonique.

Direction : **feel-good, chaleureuse, contemporaine, énergique mais pas enfantine**.

- éviter un fond majoritairement blanc ;
- privilégier des fonds teintés chauds/doux et des surfaces légèrement colorées ;
- couleurs membres distinctes, harmonieuses et suffisamment contrastées pour les graphiques ;
- typographie nette ;
- formes simples, arrondis maîtrisés ;
- couleur utilisée pour structurer l'information, pas pour décorer chaque bloc ;
- conserver accessibilité et contrastes WCAG.

Le designer peut proposer une nouvelle palette complète ; il ne doit pas être prisonnier des couleurs historiques du dépôt.

# Offre

Essai complet : 30 jours.

Après l'essai, le gratuit conserve notamment :
- un foyer ;
- ajout d'entrées libres ;
- durée manuelle ou chrono ;
- Score semaine / mois / année / depuis le début ;
- temps réel et historique du foyer.

Premium ajoute notamment selon les décisions produit :
- foyers multiples ;
- pondération avancée ;
- analyses avancées ;
- export ;
- permissions fines du foyer ;
- autres fonctions premium explicitement validées.

Standard : 2,99 EUR/mois pour 1 à 7 personnes. Pro : 5,99 EUR/mois à partir de 8 personnes ; mêmes fonctionnalités cœur, seule la taille du foyer change le prix.

# RC et production

La RC locale peut conserver les services externes désactivés tant qu'ils ne sont pas réellement configurés. Elle ne doit jamais simuler comme « réelle » une connexion OAuth, une notification push, une synchronisation calendrier, un paiement ou une synchronisation réseau.

L'architecture doit néanmoins préparer proprement les frontières pour l'identité, la synchronisation, les notifications et le calendrier sans dégrader le cœur local testable.

# Auditeur

L'auditeur doit rejeter tout candidat qui :
- met les 3 onglets au mauvais niveau (ils sont **dans un foyer**, pas au niveau global) ;
- remplace `Ajouter une tâche | Score | To-do` par Accueil/Bilan/Foyer ;
- recrée Historique/Classement/Bilan comme écrans séparés ;
- confond entrée réalisée, tâche persistante et To-do ;
- fusionne plusieurs réalisations identiques en une seule entrée historique ;
- masque les durées réelles derrière des points ;
- n'affiche pas avance/retard réel avant le graphique réel ;
- n'affiche pas le graphique pondéré + avance/retard pondéré lorsque cette métrique est disponible ;
- ne permet pas semaine/mois/année/depuis le début ;
- ne permet pas de filtrer Score par tâche persistante et Autres ;
- ajoute des commentaires moraux/relationnels ;
- conserve une UX inutilement complexe ou dominée par du blanc sans justification.

# Factory et condition terminale

Le control-plane principal reste `.github/workflows/chorescore-factory.yml` et l'état cumulatif est `lab/chorescore`.

La factory ne peut considérer le produit terminé avant que :
- le sélecteur/créateur de foyers soit cohérent avec le plan ;
- l'intérieur d'un foyer comporte Ajouter une tâche / Score / To-do ;
- les entrées réalisées fonctionnent en durée manuelle et chrono ;
- les tâches persistantes facultatives fonctionnent sans fusionner les occurrences ;
- Score fusionne historique et métriques ;
- Score calcule semaine/mois/année/depuis le début ;
- Score affiche avance/retard réel + graphique réel ;
- Score affiche la vue pondérée secondaire lorsqu'elle est utilisée ;
- Score filtre par tâche persistante / Autres ;
- To-do permet planning, attribution et deadlines localement ;
- les frontières notifications/calendrier/auth sont propres et honnêtes ;
- persistance, migration et isolation des foyers sont prouvées ;
- l'UX a été auditée comme KISS et feel-good ;
- l'APK final est construit, installé et parcouru sur Android.

**Construire ChoreScore comme un Tricount domestique : sélectionner un foyer, puis Ajouter une tâche / Score / To-do. Simple, factuel, visuel.**
